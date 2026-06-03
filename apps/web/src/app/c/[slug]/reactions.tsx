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
    <div
      ref={containerRef}
      style={{ position: 'relative', overflow: 'hidden', height: '100%', width: '100%' }}
    >
      {/* Flying emojis */}
      {flying.map((fe) => (
        <span
          key={fe.id}
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${fe.x}%`,
            fontSize: '1.6rem',
            lineHeight: 1,
            animation: 'tahti-fly-up 2.4s ease-out forwards',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {fe.emoji}
        </span>
      ))}

      {/* Emoji buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: '0.75rem',
          right: '0.75rem',
          display: 'flex',
          gap: '0.35rem',
          zIndex: 10,
        }}
      >
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => void fireReaction(emoji)}
            aria-label={`React with ${emoji}`}
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              fontSize: '1.1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(4px)',
              transition: 'transform 0.1s',
            }}
            onMouseDown={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'scale(0.85)'
            }}
            onMouseUp={(e) => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.transform = 'scale(1)'
            }}
          >
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes tahti-fly-up {
          0%   { transform: translateY(0) scale(1);   opacity: 1; }
          60%  { transform: translateY(-140px) scale(1.1); opacity: 0.9; }
          100% { transform: translateY(-220px) scale(0.7); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
