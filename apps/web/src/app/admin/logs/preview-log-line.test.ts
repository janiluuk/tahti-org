// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { previewLogLine } from './preview-log-line.js'

describe('previewLogLine', () => {
  it('collapses whitespace and truncates long lines', () => {
    expect(previewLogLine('  hello   world  ', 20)).toBe('hello world')
    expect(previewLogLine('abcdefghijklmnopqrstuvwxyz', 8)).toBe('abcdefgh…')
  })

  it('labels empty lines', () => {
    expect(previewLogLine('   ')).toBe('Empty line')
  })
})
