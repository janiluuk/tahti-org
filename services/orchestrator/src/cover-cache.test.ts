// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildCoverCacheDockerCommand, coverImagePath, shellQuote } from './cover-cache.js'

describe('coverImagePath', () => {
  it('is stable per channel id', () => {
    expect(coverImagePath('chan-1')).toBe('/cover-cache/chan-1/cover.jpg')
  })
})

describe('shellQuote', () => {
  it('single-quotes plain values', () => {
    expect(shellQuote('https://example.com/a.png')).toBe("'https://example.com/a.png'")
  })

  it('escapes embedded single quotes', () => {
    expect(shellQuote("a'b")).toBe(`'a'\\''b'`)
  })
})

describe('buildCoverCacheDockerCommand', () => {
  it('fetches the avatar via an env var, never interpolating the URL into the script text', () => {
    const cmd = buildCoverCacheDockerCommand(
      'chan-1',
      'https://cdn.tahti.live/avatar.jpg',
      'cover_vol',
    )
    expect(cmd).toContain('docker run --rm')
    expect(cmd).toContain('-e AVATAR_URL=')
    expect(cmd).toContain('https://cdn.tahti.live/avatar.jpg')
    expect(cmd).toContain('-v cover_vol:/cover-cache')
    expect(cmd).toContain('ffmpeg -y -i "$AVATAR_URL"')
    expect(cmd).toContain('mkdir -p /cover-cache/chan-1')
    expect(cmd).toContain('/cover-cache/chan-1/cover.jpg')
    expect(cmd).not.toContain('lavfi')
  })

  it('falls back to a solid-color lavfi source with no avatar and no env var', () => {
    const cmd = buildCoverCacheDockerCommand('chan-1', null, 'cover_vol')
    expect(cmd).not.toContain('AVATAR_URL')
    expect(cmd).toContain('-f lavfi -i "color=c=0x13294b:s=1280x720"')
  })

  it('scales and crops to a fixed 1280x720 canvas', () => {
    const cmd = buildCoverCacheDockerCommand('chan-1', 'https://x/y.jpg', 'cover_vol')
    expect(cmd).toContain('scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720')
  })

  it('quotes an avatar URL containing a single quote safely', () => {
    const cmd = buildCoverCacheDockerCommand('chan-1', "https://x/a'b.jpg", 'cover_vol')
    expect(cmd).toContain(`-e AVATAR_URL='https://x/a'\\''b.jpg'`)
  })
})
