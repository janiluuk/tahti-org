// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { resolveChatWebSocketUrl } from './chat-websocket'

describe('resolveChatWebSocketUrl', () => {
  it('keeps the local development endpoint on localhost', () => {
    expect(resolveChatWebSocketUrl(undefined, { hostname: 'localhost', protocol: 'http:' })).toBe(
      'ws://localhost:8000/connection/websocket',
    )
  })

  it('uses the public chat host when a production build contains a localhost fallback', () => {
    expect(
      resolveChatWebSocketUrl('ws://localhost:8000/connection/websocket', {
        hostname: 'artist.tahti.live',
        protocol: 'https:',
      }),
    ).toBe('wss://chat.tahti.live/connection/websocket')
  })

  it('upgrades an explicit websocket endpoint on an HTTPS page', () => {
    expect(
      resolveChatWebSocketUrl('ws://chat.example.com/connection/websocket', {
        hostname: 'artist.example.com',
        protocol: 'https:',
      }),
    ).toBe('wss://chat.example.com/connection/websocket')
  })
})
