// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { broadcastSessionLogFields } from './broadcast-session.js'

describe('broadcastSessionLogFields', () => {
  it('uses broadcastId as broadcastSessionId', () => {
    expect(
      broadcastSessionLogFields({
        broadcastId: 'bc_1',
        channelId: 'ch_1',
        slug: 'dj-test',
        source: 'RTMP',
      }),
    ).toEqual({
      broadcastSessionId: 'bc_1',
      broadcastId: 'bc_1',
      channelId: 'ch_1',
      slug: 'dj-test',
      source: 'RTMP',
    })
  })
})
