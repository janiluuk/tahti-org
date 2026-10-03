// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { VISUAL_PRESETS } from '@tahti/shared'
import { buildRtmpMirrorOutput, escapeLiquidsoapString, visualizerFilterFor } from './liquidsoap.js'

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
  // Arbitrary artist-chosen overlay color data, not a design token — the
  // repo's no-raw-hex lint rule targets component styling, not this.
  // eslint-disable-next-line no-restricted-syntax
  const testColor = '#22d3ee'

  it('mixes archive-eligible mirrors onto the full radio source', () => {
    const out = buildRtmpMirrorOutput(
      {
        id: 'target1',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: 'key1',
        alwaysMirror: true,
      },
      coverPath,
      'My Show',
    )
    expect(out).toContain('source.mux.video(video=')
    expect(out).toContain(', radio)')
    expect(out).toContain('url="rtmp://a.rtmp.youtube.com/live2/key1"')
  })

  it('restricts non-alwaysMirror targets to the live source only', () => {
    const out = buildRtmpMirrorOutput(
      {
        id: 'target2',
        rtmpUrl: 'rtmp://live.twitch.tv/app',
        streamKey: 'key2',
        alwaysMirror: false,
      },
      coverPath,
      'My Show',
    )
    expect(out).toContain(', live_source)')
    expect(out).not.toContain(', radio)')
  })

  it('bakes in a video track using the confirmed-working Liquidsoap 2.2.5 API', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target3', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
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
      { id: 'target4', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'DJ "Test"',
    )
    expect(out).toContain('"DJ \\"Test\\""')
  })

  it('tags the output with a telnet-safe id derived from the target id — status polling scans docker logs for this exact prefix', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'cms3abc123', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
    )
    expect(out).toContain('id="rtmp_cms3abc123"')
  })

  it('omits the subtitle text.add_text call when no subtitle is set', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target5', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
    )
    expect(out.match(/video\.add_text\(/g)).toHaveLength(1)
  })

  it('omits all add_text calls when no title is given (streamOverlayShowTitle off)', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target7', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
    )
    expect(out.match(/video\.add_text\(/g)).toBeNull()
    expect(out).toContain(`video.add_image(file="${coverPath}", width=1280, height=720, blank())`)
  })

  it('bakes an artist-editable subtitle as a second, smaller text layer', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target6', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
      'Every Friday, 8pm CET',
    )
    expect(out.match(/video\.add_text\(/g)).toHaveLength(2)
    expect(out).toContain('"Every Friday, 8pm CET"')
    expect(out).toContain('size=18')
  })

  it('uses the artist-chosen color for both title and subtitle when set', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target8', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
      'Every Friday, 8pm CET',
      testColor,
    )
    expect(out).toContain('video.add_text(color=0x22d3ee, size=28')
    expect(out).toContain('video.add_text(color=0x22d3ee, size=18')
    expect(out).not.toContain('0xffffff')
    expect(out).not.toContain('0xcbd5e1')
  })

  it('falls back to the historical hardcoded colors when no custom color is set', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target9', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
      'Every Friday, 8pm CET',
    )
    expect(out).toContain('video.add_text(color=0xffffff, size=28')
    expect(out).toContain('video.add_text(color=0xcbd5e1, size=18')
  })

  it('falls back to the historical colors for a malformed color string, never emitting an invalid literal', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target10', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
      undefined,
      'not-a-color',
    )
    expect(out).toContain('video.add_text(color=0xffffff, size=28')
    expect(out).not.toContain('not-a-color')
  })

  it('draws a scrim rectangle behind the text when enabled and title text is present', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target11', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
      undefined,
      undefined,
      true,
    )
    expect(out).toContain(
      `video.add_rectangle(color=0x000000, alpha=0.5, width=1280, height=110, x=0, y=610, video.add_image(file="${coverPath}", width=1280, height=720, blank()))`,
    )
  })

  it('omits the scrim when enabled but there is no title or subtitle to show', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target12', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      undefined,
      undefined,
      undefined,
      true,
    )
    expect(out).not.toContain('video.add_rectangle')
  })

  it('omits the scrim by default when not passed, even with title text', () => {
    const out = buildRtmpMirrorOutput(
      { id: 'target13', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false },
      coverPath,
      'My Show',
    )
    expect(out).not.toContain('video.add_rectangle')
  })

  describe('backdrop and visualizer layers', () => {
    const target = { id: 'tgt', rtmpUrl: 'rtmp://x', streamKey: 'k', alwaysMirror: false }
    const backdropPath = '/cover-cache/chan-1/backdrop.jpg'

    it('renders byte-identical output when neither a backdrop nor a visualizer is set', () => {
      const without = buildRtmpMirrorOutput(target, coverPath, 'My Show', 'Sub', testColor, true)
      expect(buildRtmpMirrorOutput(target, coverPath, 'My Show', 'Sub', testColor, true, {})).toBe(
        without,
      )
      expect(
        buildRtmpMirrorOutput(target, coverPath, 'My Show', 'Sub', testColor, true, {
          visualPreset: 'MINIMAL',
        }),
      ).toBe(without)
      expect(without).toBe(
        'output.url(\n  id="rtmp_tgt",\n  url="rtmp://x/k",\n  fallible=true,\n  %ffmpeg(\n    format="flv",\n    %audio(codec="aac", b="128k", ar=44100, ac=2),\n    %video(codec="libx264", b="2500k", preset="veryfast", pixel_format="yuv420p", framerate=30)\n  ),\n  source.mux.video(video=video.add_text(color=0x22d3ee, size=28, x=20, y=628, "My Show", video.add_text(color=0x22d3ee, size=18, x=20, y=662, "Sub", video.add_rectangle(color=0x000000, alpha=0.5, width=1280, height=110, x=0, y=610, video.add_image(file="/cover-cache/chan-1/cover.jpg", width=1280, height=720, blank())))), live_source)\n)',
      )
    })

    it('draws the backdrop full-frame behind a centered 16:9 cover card', () => {
      const out = buildRtmpMirrorOutput(target, coverPath, undefined, undefined, undefined, false, {
        backdropPath,
      })
      expect(out).toContain(
        `source.mux.video(video=video.add_image(file="${coverPath}", width=640, height=360, x=320, y=140, video.add_image(file="${backdropPath}", width=1280, height=720, blank())), live_source)`,
      )
      expect(out.startsWith('output.url(')).toBe(true)
    })

    it('keeps the scrim and text above the backdrop', () => {
      const out = buildRtmpMirrorOutput(target, coverPath, 'My Show', undefined, undefined, true, {
        backdropPath,
      })
      expect(out).toContain(
        `video.add_text(color=0xffffff, size=28, x=20, y=628, "My Show", video.add_rectangle(color=0x000000, alpha=0.5, width=1280, height=110, x=0, y=610, video.add_image(file="${coverPath}", width=640`,
      )
    })

    it('defines a per-target ffmpeg visualizer graph fed by the same audio as the mux', () => {
      const out = buildRtmpMirrorOutput(
        { ...target, alwaysMirror: true },
        coverPath,
        undefined,
        undefined,
        undefined,
        false,
        { visualPreset: 'WAVEFORM_BARS' },
      )
      expect(out.startsWith('def rtmp_tgt_vis_graph(graph) =\n')).toBe(true)
      expect(out).toContain('  a = ffmpeg.filter.audio.input(graph, radio)\n')
      expect(out).toContain('  v = ffmpeg.filter.showfreqs(graph, a)\n')
      expect(out).toContain('  v = ffmpeg.filter.scale(graph, w="1280", h="200", v)\n')
      expect(out).toContain(
        '  v = ffmpeg.filter.pad(graph, w="1280", h="720", x="0", y="520", color="black@0", v)\n',
      )
      expect(out).toContain('rtmp_tgt_vis = ffmpeg.filter.create(rtmp_tgt_vis_graph)\noutput.url(')
      expect(out).toContain(
        `source.mux.video(video=add(normalize=false, [video.add_image(file="${coverPath}", width=1280, height=720, blank()), rtmp_tgt_vis]), radio)`,
      )
    })

    it('layers backdrop, cover, visualizer, then scrim and text', () => {
      const out = buildRtmpMirrorOutput(target, coverPath, 'My Show', undefined, undefined, true, {
        backdropPath,
        visualPreset: 'WATER_RIPPLE',
      })
      expect(out).toContain('ffmpeg.filter.showwaves(graph, a)')
      expect(out).toContain('ffmpeg.filter.audio.input(graph, live_source)')
      expect(out).toContain(
        `"My Show", video.add_rectangle(color=0x000000, alpha=0.5, width=1280, height=110, x=0, y=610, add(normalize=false, [video.add_image(file="${coverPath}", width=640, height=360, x=320, y=140, video.add_image(file="${backdropPath}", width=1280, height=720, blank())), rtmp_tgt_vis])))`,
      )
    })

    it('keeps visualizer names unique per target so several mirrors can share one script', () => {
      const a = buildRtmpMirrorOutput(target, coverPath, undefined, undefined, undefined, false, {
        visualPreset: 'PARTICLE_FIELD',
      })
      const b = buildRtmpMirrorOutput(
        { ...target, id: 'other' },
        coverPath,
        undefined,
        undefined,
        undefined,
        false,
        { visualPreset: 'PARTICLE_FIELD' },
      )
      expect(a).toContain('rtmp_tgt_vis = ')
      expect(b).toContain('rtmp_other_vis = ')
    })

    it('draws no visualizer for an unknown preset', () => {
      const out = buildRtmpMirrorOutput(target, coverPath, undefined, undefined, undefined, false, {
        visualPreset: 'NOT_A_PRESET',
      })
      expect(out).not.toContain('ffmpeg.filter')
      expect(out).not.toContain('add(normalize')
    })
  })
})

describe('visualizerFilterFor', () => {
  it('maps every preset the API accepts to an ffmpeg filter or to none', () => {
    const allowed = new Set(['showwaves', 'showfreqs', 'avectorscope', null])
    for (const preset of VISUAL_PRESETS) {
      expect(allowed.has(visualizerFilterFor(preset))).toBe(true)
    }
    expect(visualizerFilterFor('MINIMAL')).toBeNull()
    expect(visualizerFilterFor('WAVEFORM_BARS')).toBe('showfreqs')
    expect(visualizerFilterFor('WATER_RIPPLE')).toBe('showwaves')
    expect(visualizerFilterFor('LINE_TANGLE')).toBe('avectorscope')
  })

  it('returns none for unknown values and inherited object keys', () => {
    expect(visualizerFilterFor(undefined)).toBeNull()
    expect(visualizerFilterFor('')).toBeNull()
    expect(visualizerFilterFor('toString')).toBeNull()
    expect(visualizerFilterFor('NOT_A_PRESET')).toBeNull()
  })
})
