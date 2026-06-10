// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { extractPalette } from './palette-extract.js'

describe('extractPalette', () => {
  it('returns null when image URL is unreachable', async () => {
    await expect(extractPalette('https://invalid.example/no-such-image.jpg')).resolves.toBeNull()
  })
})
