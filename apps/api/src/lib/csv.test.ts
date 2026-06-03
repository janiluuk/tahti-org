// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { csvEscape, csvRow } from './csv.js'

describe('csv helpers', () => {
  it('csvEscape quotes fields with commas and newlines', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"')
  })

  it('csvRow joins columns and handles nulls', () => {
    expect(csvRow(['a', 1, null, undefined])).toBe('a,1,,')
    expect(csvRow(['name', 'O"Brien, Jr.'])).toBe('name,"O""Brien, Jr."')
  })
})
