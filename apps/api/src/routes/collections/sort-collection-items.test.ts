// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { sortCollectionItems } from './helpers.js'

const older = new Date('2020-01-01T00:00:00.000Z')
const newer = new Date('2024-06-01T00:00:00.000Z')

function item(position: number, title: string, createdAt: Date) {
  return {
    position,
    sound: { title, createdAt },
    release: null,
  }
}

const items = [item(1, 'Bravo', older), item(2, 'Alpha', newer)]

describe('sortCollectionItems', () => {
  it('keeps drag order for MANUAL and unknown modes', () => {
    expect(sortCollectionItems(items, 'MANUAL').map((row) => row.position)).toEqual([1, 2])
  })

  it('sorts oldest and newest without flipping equal timestamps', () => {
    expect(sortCollectionItems(items, 'TIME').map((row) => row.sound.title)).toEqual([
      'Bravo',
      'Alpha',
    ])
    expect(sortCollectionItems(items, 'TIME_DESC').map((row) => row.sound.title)).toEqual([
      'Alpha',
      'Bravo',
    ])
  })

  it('sorts titles A–Z and Z–A', () => {
    expect(sortCollectionItems(items, 'NAME').map((row) => row.sound.title)).toEqual([
      'Alpha',
      'Bravo',
    ])
    expect(sortCollectionItems(items, 'NAME_DESC').map((row) => row.sound.title)).toEqual([
      'Bravo',
      'Alpha',
    ])
  })
})
