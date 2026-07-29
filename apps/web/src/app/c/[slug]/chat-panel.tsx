'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { LiveChatPanel, PinnedAnnouncement, type LiveChatMessage } from '@tahti/ui'
import { loadStoredChatHandle, persistChatHandle } from '@/lib/chat-handle'
import { usePlayer } from '@/contexts/player-context'
import { LoginPromptModal } from '@/components/login-prompt-modal'

interface Announcement {
  id: string
  body: string
  createdAt: string
}

interface ChatMessage {
  id: string
  handle: string
  text: string
  ts: number
  supporter?: boolean
  countryCode?: string | null
  system?: boolean
  href?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** Heart button in the chat header — loves whatever archive track is currently
 * playing (from the shared player), posting a reaction pinned to the current
 * timestamp, same as the full player's love icon. The API fans this out as a
 * "{you} loved {track}" system message back into this same chat feed. */
function ChatLoveButton() {
  const { track, currentTime } = usePlayer()
  const [pending, setPending] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  if (!track || track.kind !== 'archive') return null

  async function love() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(`${API_BASE}/api/reactions/track/${track!.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'LOVE', positionSec: currentTime }),
      })
      if (res.status === 401) setShowLogin(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="ch-chat-love-btn"
        onClick={() => void love()}
        disabled={pending}
        aria-label={`Love ${track.title}`}
        title={`Love ${track.title}`}
      >
        ❤️
      </button>
      {showLogin && (
        <LoginPromptModal
          message="Sign in to love this track."
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  )
}

export default function ChatPanel({
  slug,
  announcements,
}: {
  slug: string
  announcements: Announcement[]
}) {
  const [handle, setHandle] = useState<string>('')
  const [pendingHandle, setPendingHandle] = useState('')
  /** Read-only Centrifugo token — receive messages before join. */
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  /** Publish-capable token after handle join. */
  const [publishToken, setPublishToken] = useState<string | null>(null)
  const connectionToken = publishToken ?? viewerToken
  const [supporter, setSupporter] = useState(false)
  const [myCountryCode, setMyCountryCode] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [listenerCount, setListenerCount] = useState<number | null>(null)
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = loadStoredChatHandle()
    if (saved) {
      setHandle(saved)
      setPendingHandle(saved)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/chat/${slug}/access`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { subscribersOnly: boolean; canPostInChat: boolean } | null) => {
        if (!cancelled && data) setSubscribersOnly(data.subscribersOnly && !data.canPostInChat)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/chat/${slug}/viewer-token`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { token: string } | null) => {
        if (!cancelled && data?.token) setViewerToken((prev) => prev ?? data.token)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListenerCount(data.numClients)
      } catch {
        // ignore
      }
    }
    void poll()
    const t = setInterval(() => void poll(), 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [slug])

  useEffect(() => {
    if (!connectionToken) return
    const wsUrl =
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS ?? 'ws://localhost:8000/connection/websocket'
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      console.warn('[chat] WebSocket connect failed', e)
      return
    }
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      ws.send(JSON.stringify({ id: msgIdRef.current++, connect: { token: connectionToken } }))
    }

    ws.onmessage = (ev) => {
      for (const line of (ev.data as string).split('\n')) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line) as {
            connect?: { client: string }
            push?: { pub?: { data: unknown } }
          }
          if (data.connect) {
            ws.send(
              JSON.stringify({
                id: msgIdRef.current++,
                subscribe: { channel: `channel:${slug}` },
              }),
            )
            setStatus('connected')
          }
          if (data.push?.pub) {
            const msg = data.push.pub.data as {
              handle?: string
              text?: string
              ts?: number
              supporter?: boolean
              countryCode?: string | null
              system?: boolean
              href?: string
            }
            if (msg.text) {
              setMessages((prev) =>
                [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random()}`,
                    handle: msg.handle ?? 'anon',
                    text: msg.text!,
                    ts: msg.ts ?? Date.now(),
                    supporter: msg.supporter,
                    countryCode: msg.countryCode ?? null,
                    system: msg.system,
                    href: msg.href,
                  },
                ].slice(-100),
              )
            }
          }
        } catch {
          // malformed message
        }
      }
    }

    ws.onerror = () => setError('Connection error')
    ws.onclose = () => setStatus('disconnected')
    return () => ws.close()
  }, [connectionToken, slug])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function joinChat(h: string) {
    try {
      const res = await fetch(`${API_BASE}/api/chat/${slug}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ handle: h }),
      })
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(
          body.error === 'subscribers_only'
            ? 'This chat is subscribers-only — subscribe to the artist to post.'
            : 'You are banned from this channel.',
        )
        return
      }
      if (!res.ok) throw new Error('Failed to get token')
      const data = (await res.json()) as {
        token: string
        handle: string
        supporter?: boolean
        countryCode?: string | null
      }
      persistChatHandle(data.handle)
      setHandle(data.handle)
      setPublishToken(data.token)
      setSupporter(!!data.supporter)
      setMyCountryCode(data.countryCode ?? null)
    } catch {
      setError('Could not join chat. Try again.')
    }
  }

  function sendMessage() {
    if (!handle || !publishToken || !input.trim() || !wsRef.current || status !== 'connected') {
      return
    }
    const text = input.trim().slice(0, 500)
    wsRef.current.send(
      JSON.stringify({
        id: msgIdRef.current++,
        publish: {
          channel: `channel:${slug}`,
          data: {
            handle,
            text,
            ts: Date.now(),
            supporter: supporter || undefined,
            countryCode: myCountryCode || undefined,
          },
        },
      }),
    )
    setInput('')
  }

  const liveMessages: LiveChatMessage[] = messages.map((m) => ({
    id: m.id,
    handle: m.handle,
    text: m.text,
    tone: m.system ? 'system' : m.supporter ? 'supporter' : 'default',
    countryCode: m.countryCode,
    href: m.href,
  }))

  const displayError =
    error ??
    (subscribersOnly && !handle
      ? 'This chat is subscribers-only to post — you can still read along.'
      : null)

  return (
    <LiveChatPanel
      surface="channel"
      connected={status === 'connected'}
      listenerCount={listenerCount}
      messages={liveMessages}
      messagesRef={scrollRef}
      headerExtra={<ChatLoveButton />}
      emptyMessage="channel is quiet right now — say hi"
      pinned={
        announcements.length > 0
          ? announcements.map((a) => <PinnedAnnouncement key={a.id}>{a.body}</PinnedAnnouncement>)
          : undefined
      }
      authPhase={handle ? 'chat' : 'join'}
      joinHandle={pendingHandle}
      onJoinHandleChange={setPendingHandle}
      onJoin={() => void joinChat(pendingHandle)}
      inputValue={input}
      onInputChange={setInput}
      onSend={sendMessage}
      inputDisabled={!publishToken || status !== 'connected'}
      sendDisabled={!publishToken || status !== 'connected'}
      error={displayError}
    />
  )
}
