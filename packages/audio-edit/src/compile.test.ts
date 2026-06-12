// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  compileFiltergraph,
  compileLoudnormPass1Filter,
  estimateOutputBytes,
  remapTracklistTimestamps,
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
})
