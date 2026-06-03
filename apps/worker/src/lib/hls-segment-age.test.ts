// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdir, writeFile, rm, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hlsSegmentAgeSecFromFs } from './hls-segment-age.js'

describe('hlsSegmentAgeSecFromFs', () => {
  const root = join(tmpdir(), `tahti-hls-test-${process.pid}`)
  const channelId = 'ch-test-1'

  beforeAll(async () => {
    await mkdir(join(root, channelId), { recursive: true })
    const seg = join(root, channelId, 'seg-001.ts')
    await writeFile(seg, Buffer.alloc(100))
    const past = new Date(Date.now() - 30_000)
    await utimes(seg, past, past)
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('returns age in seconds for newest segment', async () => {
    const age = await hlsSegmentAgeSecFromFs(root, channelId)
    expect(age).not.toBeNull()
    expect(age!).toBeGreaterThan(20)
    expect(age!).toBeLessThan(120)
  })
})
