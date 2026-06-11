'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState } from 'react'
import { LiveChatPanel, PinnedAnnouncement, type LiveChatMessage } from '@tahti/ui'
import { loadStoredChatHandle, persistChatHandle } from '@/lib/chat-handle'

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
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

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
    const ws = new WebSocket(wsUrl)
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
        setError('You are banned from this channel.')
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
    tone: m.supporter ? 'supporter' : 'default',
    countryCode: m.countryCode,
  }))

  return (
    <LiveChatPanel
      surface="channel"
      connected={status === 'connected'}
      listenerCount={listenerCount}
      messages={liveMessages}
      messagesRef={scrollRef}
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
      error={error}
    />
  )
}
