// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildRegistryThemeFile, registryThemeSlug } from './registry-theme-file.js'

describe('buildRegistryThemeFile', () => {
  it('fills every field the registry schema requires', () => {
    const file = buildRegistryThemeFile({
      name: 'Night Shift',
      author: 'Aino',
      varsJson: { background: 'white', primary: 'teal' },
      darkJson: { background: 'black', foreground: 'gainsboro' },
    })
    expect(file.version).toBe(1)
    expect(file.name).toBe('Night Shift')
    expect(file.author).toBe('Aino')
    expect(file.description.length).toBeGreaterThanOrEqual(10)
    expect(file.description.length).toBeLessThanOrEqual(200)
    expect(file.tags).toEqual([])
    expect(file.palette).toHaveLength(4)
  })

  it('takes the palette from the dark values first, then the light ones', () => {
    const file = buildRegistryThemeFile({
      name: 'Night Shift',
      author: 'Aino',
      varsJson: { background: 'white', primary: 'teal' },
      darkJson: { background: 'black', foreground: 'gainsboro' },
    })
    expect(file.palette).toEqual(['black', 'rgb(31 31 31)', 'teal', 'gainsboro'])
  })

  it('drops a leading -- and values that are not strings', () => {
    const file = buildRegistryThemeFile({
      name: 'Odd',
      author: 'Aino',
      varsJson: { '--primary': 'navy', radius: 4, nested: { a: 1 } },
      darkJson: null,
    })
    expect(file.vars).toEqual({ primary: 'navy' })
    expect(file.dark).toEqual({})
  })

  it('falls back when the name or author is blank', () => {
    const file = buildRegistryThemeFile({ name: '  ', author: '', varsJson: {}, darkJson: {} })
    expect(file.name).toBe('Untitled theme')
    expect(file.author).toBe('Tahti artist')
  })
})

describe('registryThemeSlug', () => {
  it('makes a file-safe id', () => {
    expect(registryThemeSlug('Night Shift!')).toBe('night-shift')
    expect(registryThemeSlug('???')).toBe('theme')
  })
})
