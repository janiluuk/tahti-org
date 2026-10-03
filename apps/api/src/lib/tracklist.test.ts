// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { formatTracklistTimestamp, normalizeTracklist } from './tracklist.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'

describe('formatTracklistTimestamp', () => {
  it('formats under one hour as m:ss', () => {
    expect(formatTracklistTimestamp(125)).toBe('2:05')
  })

  it('formats hours as h:mm:ss', () => {
    expect(formatTracklistTimestamp(3661)).toBe('1:01:01')
  })
})

describe('normalizeTracklist', () => {
  const PREFIX = 'tracklist-test-'

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('credits a tagged artist by their name, or their username when the name is an email', async () => {
    await createTestArtist(prisma, {
      email: `${PREFIX}named@example.com`,
      username: `${PREFIX}named`,
      displayName: 'Named Artist',
    })
    await createTestArtist(prisma, {
      email: `${PREFIX}mail@example.com`,
      username: `${PREFIX}mail`,
      displayName: `${PREFIX}mail@example.com`,
    })

    const result = await normalizeTracklist(prisma, [
      { startSec: 0, title: 'One', artistUsername: `${PREFIX}named` },
      { startSec: 60, title: 'Two', artistUsername: `${PREFIX}mail` },
    ])
    expect(result.map((e) => e.artist)).toEqual(['Named Artist', `${PREFIX}mail`])
  })
})
