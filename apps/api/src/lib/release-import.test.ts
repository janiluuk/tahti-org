// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseReleaseImportCsv } from './release-import.js'

describe('M12 — release import CSV', () => {
  it('groups tracks by release title and date', () => {
    const csv = `releaseTitle,type,releaseDate,trackTitle,isrc
Summer EP,EP,2026-06-01,Intro,
Summer EP,EP,2026-06-01,Main Mix,FI-ABC-123
Single,SINGLE,2026-07-01,Only Track,`

    const { groups, errors } = parseReleaseImportCsv(csv)
    expect(errors).toHaveLength(0)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveLength(2)
    expect(groups[0]![0]!.releaseTitle).toBe('Summer EP')
    expect(groups[1]![0]!.type).toBe('SINGLE')
  })

  it('reports row errors', () => {
    const csv = `releaseTitle,releaseDate,trackTitle
Bad,,Missing date`
    const { groups, errors } = parseReleaseImportCsv(csv)
    expect(groups).toHaveLength(0)
    expect(errors.length).toBeGreaterThan(0)
  })
})
