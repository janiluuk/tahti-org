// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildRtmpMirrorOutput, escapeLiquidsoapString } from './liquidsoap.js'

describe('escapeLiquidsoapString', () => {
  it('escapes double quotes and backslashes for a Liquidsoap string literal', () => {
    expect(escapeLiquidsoapString('DJ "Test" \\ Artist')).toBe('DJ \\"Test\\" \\\\ Artist')
  })

  it('leaves plain text untouched', () => {
    expect(escapeLiquidsoapString('My Show')).toBe('My Show')
  })
})

describe('buildRtmpMirrorOutput', () => {
  const coverPath = '/cover-cache/chan-1/cover.jpg'

  it('mixes archive-eligible mirrors onto the full radio source', () => {
    const out = buildRtmpMirrorOutput(
      { rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2', streamKey: 'key1', alwaysMirror: true },
      coverPath,
      'My Show',
    )
    expect(out).toContain('source.mux.video(video=')
    expect(out).toContain(', radio)')
    expect(out).toContain('url="rtmp://a.rtmp.youtube.com/live2/key1"')
  })

  it('restricts non-alwaysMirror targets to the live source only', () => {
    const out = buildRtmpMirrorOutput(
      { rtmpUrl: 'rtmp://live.twitch.tv/app', streamKey: 'key2', alwaysMirror: false },
      coverPath,
      'My Show',
    )
    expect(out).toContain(', live_source)')
    expect(out).not.toContain(', radio)')
  })

  it('bakes in a video track using the confirmed-working Liquidsoap 2.2.5 API', () => {
    const out = buildRtmpMirrorOutput(
      { rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
    )
    // video.add_image takes no `duration` arg on this build — confirmed via
    // `liquidsoap --check` against savonet/liquidsoap:v2.2.5.
    expect(out).not.toContain('duration=infinity')
    expect(out).toContain(`video.add_image(file="${coverPath}", width=1280, height=720, blank())`)
    expect(out).toContain('video.add_text(color=0xffffff, size=28, x=20, y=628, "My Show"')
    expect(out).toContain('%video(codec="libx264"')
    expect(out).not.toContain('%video.raw')
    expect(out).not.toContain('mux(audio=')
  })

  it('escapes a title containing quotes so it stays a valid Liquidsoap string', () => {
    const out = buildRtmpMirrorOutput(
      { rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'DJ "Test"',
    )
    expect(out).toContain('"DJ \\"Test\\""')
  })
})
