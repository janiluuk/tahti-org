// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveChatWebSocketUrl } from '@/lib/chat-websocket'
import { resolveClientApiUrl } from '@/lib/api-url'

/** How long the connection must stay down before the reconnect banner shows. */
export const CHAT_RECONNECT_BANNER_DELAY_MS = 3000

export type ChatConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export type CentrifugoChatMessage = {
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

export type CentrifugoPublishPayload = {
  handle: string
  text: string
  supporter?: boolean
  channelRole?: 'owner' | 'moderator' | null
  countryCode?: string | null
}

type CentrifugoWireMessage = {
  connect?: { client: string }
  error?: { message?: string }
  push?: { pub?: { data: unknown } }
}

function parseInboundPush(data: unknown): CentrifugoChatMessage | null {
  if (!data || typeof data !== 'object') return null
  const msg = data as {
    handle?: string
    text?: string
    ts?: number
    supporter?: boolean
    channelRole?: 'owner' | 'moderator' | null
    countryCode?: string | null
    system?: boolean
    href?: string
  }
  if (!msg.text) return null
  return {
    id: `${msg.ts ?? Date.now()}-${Math.random()}`,
    handle: msg.handle ?? 'anon',
    text: msg.text,
    ts: msg.ts ?? Date.now(),
    supporter: msg.supporter,
    channelRole: msg.channelRole ?? null,
    countryCode: msg.countryCode ?? null,
    system: msg.system,
    href: msg.href,
  }
}

/** Shared @-mention search used by live + fan chat composers. */
export async function searchChatMentions(
  query: string,
): Promise<Array<{ username: string; displayName: string }>> {
  if (query.trim().length < 1) return []
  try {
    const res = await fetch(
      `${resolveClientApiUrl()}/api/users/search?q=${encodeURIComponent(query)}`,
      { credentials: 'include' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{ username: string; displayName: string }>
    return data.map((u) => ({ username: u.username, displayName: u.displayName }))
  } catch {
    return []
  }
}

/**
 * Centrifugo websocket session for channel / fan chat.
 * Handles connect → subscribe, inbound pushes, publish, and reconnect backoff.
 */
export function useCentrifugoChat({
  token,
  channel,
  reconnectBannerDelayMs = CHAT_RECONNECT_BANNER_DELAY_MS,
}: {
  token: string | null
  /** Full Centrifugo channel name, e.g. `channel:slug` or the fan-chat channel from the token API. */
  channel: string | null
  reconnectBannerDelayMs?: number
}) {
  const [messages, setMessages] = useState<CentrifugoChatMessage[]>([])
  const [status, setStatus] = useState<ChatConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const msgIdRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token || !channel) {
      setStatus('disconnected')
      return
    }

    const activeToken = token
    const activeChannel = channel
    const wsUrl = resolveChatWebSocketUrl(process.env.NEXT_PUBLIC_CENTRIFUGO_WS, window.location)
    let ws: WebSocket | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let errorTimer: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0
    let cancelled = false

    function connect() {
      setStatus('connecting')
      try {
        ws = new WebSocket(wsUrl)
      } catch (connectError) {
        console.warn('[chat] WebSocket connect failed', connectError)
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            id: msgIdRef.current++,
            connect: { token: activeToken, name: 'js' },
          }),
        )
      }

      ws.onmessage = (ev) => {
        for (const line of (ev.data as string).split('\n')) {
          if (!line.trim()) continue
          try {
            const data = JSON.parse(line) as CentrifugoWireMessage
            if (data.error) {
              setError(data.error.message ?? 'Could not connect to live chat.')
              continue
            }
            if (data.connect) {
              retryAttempt = 0
              if (errorTimer) {
                clearTimeout(errorTimer)
                errorTimer = null
              }
              setError(null)
              ws?.send(
                JSON.stringify({
                  id: msgIdRef.current++,
                  subscribe: { channel: activeChannel },
                }),
              )
              setStatus('connected')
            }
            if (!data.push?.pub) continue
            const inbound = parseInboundPush(data.push.pub.data)
            if (!inbound) continue
            setMessages((prev) => [...prev, inbound].slice(-100))
          } catch {
            // malformed message
          }
        }
      }

      ws.onerror = () => ws?.close()
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null
        if (!cancelled) scheduleReconnect()
      }
    }

    function scheduleReconnect() {
      if (cancelled || retryTimer) return
      setStatus('connecting')
      if (!errorTimer) {
        errorTimer = setTimeout(() => {
          errorTimer = null
          setError('Chat connection lost — reconnecting…')
        }, reconnectBannerDelayMs)
      }
      const delay = Math.min(1000 * 2 ** retryAttempt++, 15_000)
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, delay)
    }

    connect()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (errorTimer) clearTimeout(errorTimer)
      ws?.close()
    }
  }, [token, channel, reconnectBannerDelayMs])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const channelRef = useRef(channel)
  channelRef.current = channel

  const publish = useCallback(
    (payload: CentrifugoPublishPayload): boolean => {
      const text = payload.text.trim().slice(0, 500)
      const publishChannel = channelRef.current
      if (!text || !wsRef.current || !publishChannel || status !== 'connected') return false
      wsRef.current.send(
        JSON.stringify({
          id: msgIdRef.current++,
          publish: {
            channel: publishChannel,
            data: {
              handle: payload.handle,
              text,
              ts: Date.now(),
              supporter: payload.supporter || undefined,
              channelRole: payload.channelRole || undefined,
              countryCode: payload.countryCode || undefined,
            },
          },
        }),
      )
      return true
    },
    [status],
  )

  return {
    messages,
    setMessages,
    status,
    error,
    setError,
    scrollRef,
    publish,
  }
}

/** Exported for unit tests — keep push parsing behaviour stable across panels. */
export const __testOnly = { parseInboundPush }
