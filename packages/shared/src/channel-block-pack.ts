// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Channel Designer block widths. Integer sixths so packing stays exact. */
export const CHANNEL_BLOCK_WIDTHS = ['FULL', 'HALF', 'THIRD'] as const
export type ChannelBlockWidth = (typeof CHANNEL_BLOCK_WIDTHS)[number]

export const CHANNEL_BLOCK_TYPES = ['LOGO', 'ADDON'] as const
export type ChannelBlockType = (typeof CHANNEL_BLOCK_TYPES)[number]

/** Units of a 6-column row: FULL fills it, HALF takes 3, THIRD takes 2. */
export const CHANNEL_BLOCK_WIDTH_UNITS: Record<ChannelBlockWidth, number> = {
  FULL: 6,
  HALF: 3,
  THIRD: 2,
}

export const CHANNEL_BLOCK_ROW_UNITS = 6

/**
 * Greedy row-packing for an ordered block list. A FULL always starts a new
 * row; leftover space in a row is left unfilled rather than wrapping the
 * next block up. Same function for the editor preview and public render.
 */
export function packChannelBlocks<T extends { width: ChannelBlockWidth }>(blocks: T[]): T[][] {
  const rows: T[][] = []
  let current: T[] = []
  let used = 0

  for (const block of blocks) {
    const units = CHANNEL_BLOCK_WIDTH_UNITS[block.width]
    if (current.length > 0 && used + units > CHANNEL_BLOCK_ROW_UNITS) {
      rows.push(current)
      current = []
      used = 0
    }
    current.push(block)
    used += units
  }

  if (current.length > 0) rows.push(current)
  return rows
}
