// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  compileFiltergraph,
  compileLoudnormPass1Filter,
  estimateOutputBytes,
  isFiltergraphTooLarge,
  remapTracklistTimestamps,
  shouldRenderInBrowser,
  shouldUseSegmentRender,
} from './compile.js'
import { computeKeepSegments, mergeCuts, sourceTimeToPostCut } from './segments.js'
import { createDefaultEditList } from './types.js'
import { validateEditListParsed } from './validate.js'

describe('segments', () => {
  it('merges overlapping cuts', () => {
    expect(
      mergeCuts([
        { start: 10, end: 25 },
        { start: 20, end: 30 },
      ]),
    ).toEqual([{ start: 10, end: 30 }])
  })

  it('maps source time across cuts', () => {
    const segs = computeKeepSegments(100, [{ start: 10, end: 20 }])
    expect(sourceTimeToPostCut(25, segs)).toBe(15)
    expect(sourceTimeToPostCut(15, segs)).toBeNull()
  })
})

describe('compileFiltergraph', () => {
  it('builds loudnorm two-pass chain', () => {
    const edit = createDefaultEditList(120)
    edit.loudnorm = {
      enabled: true,
      targetLufs: -14,
      targetTp: -1.5,
      measured: { i: -17.8, tp: -2.9, lra: 8.4, thresh: -28.1 },
    }
    expect(compileFiltergraph(edit).filtergraph).toContain('linear=true')
    expect(compileLoudnormPass1Filter(edit)).toContain('print_format=json')
  })

  it('remaps tracklist through cuts', () => {
    const edit = createDefaultEditList(100)
    edit.cuts = [{ start: 10, end: 20 }]
    const remapped = remapTracklistTimestamps(
      [
        { startSec: 5, title: 'A' },
        { startSec: 15, title: 'B' },
        { startSec: 25, title: 'C' },
      ],
      edit,
    )
    expect(remapped.map((r) => r.title)).toEqual(['A', 'C'])
  })
})

describe('limiter', () => {
  it('places alimiter before loudnorm and emits nothing when bypassed', () => {
    const edit = createDefaultEditList(120)
    edit.limiter = { enabled: true, ceilingDb: -1, releaseMs: 50 }
    edit.loudnorm = { enabled: true, targetLufs: -14, targetTp: -1.5 }
    const { filtergraph } = compileFiltergraph(edit)
    const limIdx = filtergraph.indexOf('alimiter=')
    const loudIdx = filtergraph.indexOf('loudnorm=')
    expect(limIdx).toBeGreaterThan(-1)
    expect(loudIdx).toBeGreaterThan(limIdx)

    const bypassed = createDefaultEditList(120)
    expect(compileFiltergraph(bypassed).filtergraph).not.toContain('alimiter=')
  })
})

describe('validateEditListParsed', () => {
  it('rejects full cut', () => {
    const edit = createDefaultEditList(60)
    edit.cuts = [{ start: 0, end: 60 }]
    expect(validateEditListParsed(edit).ok).toBe(false)
  })
})

describe('estimateOutputBytes', () => {
  it('flags large files for server render', () => {
    const edit = createDefaultEditList(7200)
    expect(estimateOutputBytes(edit, 1411)).toBeGreaterThan(600 * 1024 * 1024)
  })

  it('uses source file size when larger than output estimate', () => {
    const edit = createDefaultEditList(60)
    expect(shouldRenderInBrowser(edit, 700 * 1024 * 1024)).toBe(false)
    expect(shouldRenderInBrowser(edit, 1024)).toBe(true)
  })
})

describe('shouldUseSegmentRender', () => {
  it('returns true when many cuts fragment the timeline', () => {
    const edit = createDefaultEditList(3600)
    edit.cuts = Array.from({ length: 8 }, (_, i) => ({
      start: i * 400 + 10,
      end: i * 400 + 20,
    }))
    expect(shouldUseSegmentRender(edit)).toBe(true)
  })

  it('returns false for a simple trim with no cuts', () => {
    expect(shouldUseSegmentRender(createDefaultEditList(120))).toBe(false)
  })

  it('returns true when filtergraph exceeds size budget', () => {
    const edit = createDefaultEditList(10)
    edit.cuts = Array.from({ length: 500 }, (_, i) => ({
      start: i * 0.01,
      end: i * 0.01 + 0.004,
    }))
    expect(isFiltergraphTooLarge(edit)).toBe(true)
    expect(shouldUseSegmentRender(edit)).toBe(true)
    expect(compileFiltergraph(edit).filtergraph.length).toBeGreaterThan(24_000)
  })
})
