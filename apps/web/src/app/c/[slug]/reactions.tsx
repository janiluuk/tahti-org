// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const EMOJIS = ['💜', '🔥', '🎶', '🎵', '🌟', '👏']

interface FlyingEmoji {
  id: string
  emoji: string
  x: number
}

export default function ReactionsOverlay({ slug }: { slug: string }) {
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const spawnEmoji = useCallback((emoji: string) => {
    const id = `${Date.now()}-${Math.random()}`
    const x = 10 + Math.random() * 80 // percentage across the container
    setFlying((prev) => [...prev.slice(-20), { id, emoji, x }])
    setTimeout(() => setFlying((prev) => prev.filter((e) => e.id !== id)), 2500)
  }, [])

  // Connect to Centrifugo for incoming reactions from other users
  useEffect(() => {
    let token: string | null = null
    let ws: WebSocket | null = null

    const connect = async () => {
      try {
        const res = await fetch(`/api/chat/${slug}/reactions-token`)
        if (!res.ok) return
        const data = (await res.json()) as { token: string }
        token = data.token
      } catch {
        return
      }

      const wsUrl =
        process.env.NEXT_PUBLIC_CENTRIFUGO_WS ?? 'ws://localhost:8000/connection/websocket'
      ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws!.send(JSON.stringify({ id: msgIdRef.current++, connect: { token } }))
      }

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as {
            connect?: unknown
            push?: { channel?: string; pub?: { data: unknown } }
          }

          if (msg.connect) {
            ws!.send(
              JSON.stringify({
                id: msgIdRef.current++,
                subscribe: { channel: `reactions:${slug}` },
              }),
            )
          }

          if (msg.push?.channel === `reactions:${slug}` && msg.push.pub) {
            const data = msg.push.pub.data as { emoji?: string }
            if (data.emoji) spawnEmoji(data.emoji)
          }
        } catch {
          // malformed
        }
      }
    }

    void connect()

    return () => {
      ws?.close()
    }
  }, [slug, spawnEmoji])

  async function fireReaction(emoji: string) {
    // Optimistic local display
    spawnEmoji(emoji)

    // Tell the server (which broadcasts to all others)
    await fetch(`/api/chat/${slug}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    }).catch(() => null)
  }

  return (
    <div ref={containerRef} className="ch-reactions">
      {flying.map((fe) => (
        <span
          key={fe.id}
          aria-hidden="true"
          className="ch-reaction-fly"
          style={{ ['--ch-reaction-x' as string]: `${fe.x}%` }}
        >
          {fe.emoji}
        </span>
      ))}

      <div className="ch-reaction-bar">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="ch-reaction-btn"
            onClick={() => void fireReaction(emoji)}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
