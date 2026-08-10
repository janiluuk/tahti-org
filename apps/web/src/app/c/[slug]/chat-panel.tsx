'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useMemo, useRef, useState } from 'react'
import { LiveChatPanel, PinnedAnnouncement, type LiveChatMessage } from '@tahti/ui'
import { loadStoredChatHandle, persistChatHandle } from '@/lib/chat-handle'
import {
  clearChatCaptchaVerifiedLocally,
  markChatCaptchaVerifiedLocally,
  wasChatCaptchaRecentlyVerified,
} from '@/lib/chat-captcha-memory'
import { useHcaptcha } from '@/lib/use-hcaptcha'
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
  channelRole?: 'owner' | 'moderator' | null
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
  isLoggedIn = false,
}: {
  slug: string
  announcements: Announcement[]
  /** Signed-in members skip the captcha entirely — the server already treats
   * a session as a stronger anti-abuse signal than a captcha (see
   * apps/api/src/routes/chat/token.ts), the client just never checked login
   * state before, so it loaded/rendered the widget for everyone regardless. */
  isLoggedIn?: boolean
}) {
  const [handle, setHandle] = useState<string>('')
  const [pendingHandle, setPendingHandle] = useState('')
  // Anonymous visitors start on a plain "Join chat" prompt — the handle
  // input and (for them only) the captcha widget don't appear until they
  // actually decide to join, instead of loading/rendering immediately on
  // page load before any interaction.
  const [joinStarted, setJoinStarted] = useState(false)
  /** Read-only Centrifugo token — receive messages before join. */
  const [viewerToken, setViewerToken] = useState<string | null>(null)
  /** Publish-capable token after handle join. */
  const [publishToken, setPublishToken] = useState<string | null>(null)
  const connectionToken = publishToken ?? viewerToken
  const [supporter, setSupporter] = useState(false)
  const [channelRole, setChannelRole] = useState<'owner' | 'moderator' | null>(null)
  const [myCountryCode, setMyCountryCode] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [listenerCount, setListenerCount] = useState<number | null>(null)
  const [dailyListenerCount, setDailyListenerCount] = useState<number | null>(null)
  const [subscribersOnly, setSubscribersOnly] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const {
    captchaRef,
    required: hcaptchaConfigured,
    getToken,
    reset: resetCaptcha,
  } = useHcaptcha(joinStarted && !isLoggedIn)
  // Signed-in members never need a captcha at all (see isLoggedIn doc above)
  // — captchaRequired (not the raw hook value) gates every actual join-flow
  // decision below, so it's never true for them even though hCaptcha itself
  // is configured site-wide.
  const captchaRequired = hcaptchaConfigured && !isLoggedIn

  // A returning visitor already has a handle saved from a previous visit —
  // silently rejoin with it to get a fresh publish token. Previously this just
  // set `handle` directly, which flips the panel into "chat" phase (hiding the
  // join prompt) without ever fetching a token — publishToken stayed null
  // forever, so sendDisabled/inputDisabled (which gate on !publishToken)
  // stayed true forever and returning visitors could never actually send.
  // When hCaptcha is enforced, skip auto-rejoin — the widget must be solved
  // on an explicit Join click — UNLESS this browser already solved it for
  // this channel recently (wasChatCaptchaRecentlyVerified): joinChat() below
  // then attempts the join with no fresh token, and the server independently
  // confirms the same "recently verified" fact before accepting it (see the
  // comment in chat-captcha-memory.ts) — worst case it's rejected and the
  // visitor falls back to the widget, same as before this existed.
  useEffect(() => {
    const saved = loadStoredChatHandle()
    if (saved) {
      setPendingHandle(saved)
      if (!captchaRequired || wasChatCaptchaRecentlyVerified(slug)) void joinChat(saved)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captchaRequired])

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

  // Chat has no database persistence — messages only live in Centrifugo's own
  // history buffer (history_size/history_ttl, infra/centrifugo.json). Without
  // this fetch, every page load or WS reconnect started from a blank chat.
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/chat/${slug}/history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { messages: Omit<ChatMessage, 'id'>[] } | null) => {
        if (cancelled || !data?.messages?.length) return
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => `${m.ts}-${m.handle}-${m.text}`))
          const history = data.messages
            .filter((m) => !seen.has(`${m.ts}-${m.handle}-${m.text}`))
            .map((m, i) => ({ ...m, id: `history-${m.ts}-${i}` }))
          return [...history, ...prev].sort((a, b) => a.ts - b.ts).slice(-100)
        })
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

  // Artist-controlled (Settings → Artist info → "Show today's listener count") —
  // the endpoint itself reports enabled=false when they've turned it off, so
  // this stays null (hidden) in that case rather than needing a second fetch.
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/channels/${slug}/daily-listeners`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count: number; enabled: boolean } | null) => {
        if (!cancelled && data?.enabled) setDailyListenerCount(data.count)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
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
              channelRole?: 'owner' | 'moderator' | null
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
                    channelRole: msg.channelRole ?? null,
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
      if (captchaRequired && !getToken() && !wasChatCaptchaRecentlyVerified(slug)) {
        setError('Complete the captcha to join chat.')
        return
      }
      const res = await fetch(`${API_BASE}/api/chat/${slug}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ handle: h, hcaptchaToken: getToken() }),
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        resetCaptcha()
        if (body.error === 'hCaptcha verification failed') {
          clearChatCaptchaVerifiedLocally(slug)
        }
        setError(
          body.error === 'hCaptcha verification failed'
            ? 'Captcha failed — try again.'
            : 'Could not join chat. Try again.',
        )
        return
      }
      const data = (await res.json()) as {
        token: string
        handle: string
        supporter?: boolean
        countryCode?: string | null
        channelRole?: 'owner' | 'moderator' | null
      }
      persistChatHandle(data.handle)
      if (captchaRequired) markChatCaptchaVerifiedLocally(slug)
      setHandle(data.handle)
      setPublishToken(data.token)
      setSupporter(!!data.supporter)
      setChannelRole(data.channelRole ?? null)
      setMyCountryCode(data.countryCode ?? null)
      setError(null)
      resetCaptcha()
    } catch {
      resetCaptcha()
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
            channelRole: channelRole || undefined,
            countryCode: myCountryCode || undefined,
          },
        },
      }),
    )
    setInput('')
  }

  // Tahti Radio's chat aggregates every listener on the platform, so this
  // recomputes far more often than on a typical channel — memoizing means a
  // re-render triggered by something else (listenerCount polling, daily
  // count, etc.) reuses the same array/message objects instead of mapping
  // all 100 messages fresh, which would also defeat ChatMessageRow's own
  // memoization downstream (new object identity every render = no bailout).
  const liveMessages: LiveChatMessage[] = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        handle: m.handle,
        text: m.text,
        tone: m.system
          ? 'system'
          : m.channelRole === 'owner'
            ? 'artist'
            : m.channelRole === 'moderator'
              ? 'moderator'
              : m.supporter
                ? 'supporter'
                : 'default',
        countryCode: m.countryCode,
        href: m.href,
        ts: m.ts,
      })),
    [messages],
  )

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
      dailyListenerCount={dailyListenerCount}
      messages={liveMessages}
      messagesRef={scrollRef}
      headerExtra={<ChatLoveButton />}
      emptyMessage="channel is quiet right now — say hi"
      pinned={
        announcements.length > 0
          ? announcements.map((a) => <PinnedAnnouncement key={a.id}>{a.body}</PinnedAnnouncement>)
          : undefined
      }
      authPhase={handle ? 'chat' : joinStarted ? 'join' : 'prompt'}
      onStartJoin={() => setJoinStarted(true)}
      joinHandle={pendingHandle}
      onJoinHandleChange={setPendingHandle}
      onJoin={() => void joinChat(pendingHandle)}
      captchaSlot={captchaRequired ? <div ref={captchaRef} /> : undefined}
      inputValue={input}
      onInputChange={setInput}
      onSend={sendMessage}
      inputDisabled={!publishToken || status !== 'connected'}
      sendDisabled={!publishToken || status !== 'connected'}
      error={displayError}
      onSearchMentions={async (query) => {
        if (query.trim().length < 1) return []
        try {
          const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`, {
            credentials: 'include',
          })
          if (!res.ok) return []
          const data = (await res.json()) as Array<{
            username: string
            displayName: string
          }>
          return data.map((u) => ({ username: u.username, displayName: u.displayName }))
        } catch {
          return []
        }
      }}
    />
  )
}
