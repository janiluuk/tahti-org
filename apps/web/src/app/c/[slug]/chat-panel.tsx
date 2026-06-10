// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'

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

import { loadStoredChatHandle, persistChatHandle } from '@/lib/chat-handle'
import { flagEmoji } from '@/lib/flag-emoji'

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
  const [token, setToken] = useState<string | null>(null)
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

  // Load saved handle from localStorage or API cookie (LISTENER-003)
  useEffect(() => {
    const saved = loadStoredChatHandle()
    if (saved) {
      setHandle(saved)
      setPendingHandle(saved)
    }
  }, [])

  // Connect read-only on load so visitors see live chat without joining first.
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/chat/${slug}/viewer-token`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { token: string } | null) => {
        if (!cancelled && data?.token) setToken((prev) => prev ?? data.token)
      })
      .catch(() => {
        // ignore — chat just stays disconnected
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  // Poll listener count every 30s
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListenerCount(data.numClients)
      } catch {
        // ignore — presence is best-effort
      }
    }
    void poll()
    const t = setInterval(() => void poll(), 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [slug])

  // Connect to Centrifugo when we have a token
  useEffect(() => {
    if (!token) return
    const wsUrl =
      process.env.NEXT_PUBLIC_CENTRIFUGO_WS ?? 'ws://localhost:8000/connection/websocket'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => {
      // Send connect command with token
      ws.send(
        JSON.stringify({
          id: msgIdRef.current++,
          connect: { token },
        }),
      )
    }

    ws.onmessage = (ev) => {
      // Centrifugo can coalesce multiple replies/pushes (e.g. a publish ack
      // plus the echoed push for that same publication) into one frame as
      // newline-delimited JSON — each line must be parsed independently.
      for (const line of (ev.data as string).split('\n')) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line) as {
            id?: number
            connect?: { client: string }
            push?: { channel?: string; pub?: { data: unknown } }
          }

          if (data.connect) {
            // Connected — subscribe to channel
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
              const id = `${Date.now()}-${Math.random()}`
              setMessages((prev) =>
                [
                  ...prev,
                  {
                    id,
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
  }, [token, slug])

  // Auto-scroll to bottom on new messages
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
      setToken(data.token)
      setSupporter(!!data.supporter)
      setMyCountryCode(data.countryCode ?? null)
    } catch {
      setError('Could not join chat. Try again.')
    }
  }

  function sendMessage() {
    if (!input.trim() || !wsRef.current || status !== 'connected') return
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

  return (
    <aside className="ch-chat-panel">
      <div className="ch-chat-panel__head">
        <h4>LIVE CHAT</h4>
        {status === 'connected' && <span className="ch-chat-live-badge">live</span>}
        {listenerCount !== null && listenerCount > 0 && (
          <span className="ch-chat-listeners">
            {listenerCount} {listenerCount === 1 ? 'listener' : 'listeners'}
          </span>
        )}
      </div>

      {announcements.length > 0 && (
        <div className="ch-chat-announcements">
          {announcements.map((a) => (
            <div key={a.id} className="pinned-msg">
              <div className="pin-label">📌 PINNED</div>
              {a.body}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="ch-chat-messages">
        {messages.length === 0 && (
          <p className="ch-chat-empty">channel is quiet right now — say hi</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="chat-msg">
            {m.countryCode && (
              <span className="chat-flag" aria-label={m.countryCode} title={m.countryCode}>
                {flagEmoji(m.countryCode)}
              </span>
            )}
            <span className={`handle${m.supporter ? ' supporter' : ''}`}>{m.handle}</span>
            {m.supporter && <span className="chat-supporter-badge">supporter</span>}
            <span className="text">{m.text}</span>
          </div>
        ))}
      </div>

      {error && <div className="ch-chat-error">{error}</div>}

      <div className="ch-chat-input-row">
        {!token ? (
          <>
            <input
              placeholder="Your handle"
              value={pendingHandle}
              onChange={(e) => setPendingHandle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void joinChat(pendingHandle)
              }}
              maxLength={32}
            />
            <button
              type="button"
              className="ch-chat-send"
              onClick={() => void joinChat(pendingHandle)}
            >
              Join
            </button>
          </>
        ) : (
          <>
            <input
              placeholder="Say something…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage()
              }}
              maxLength={500}
              disabled={status !== 'connected'}
            />
            <button
              type="button"
              className="ch-chat-send"
              onClick={sendMessage}
              disabled={status !== 'connected'}
            >
              Send
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
