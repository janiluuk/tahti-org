// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ChannelBlockWidthInput } from './dto/channel-blocks.js'

const MAX_PER_ROW: Record<ChannelBlockWidthInput, number> = {
  FULL: 1,
  HALF: 2,
  THIRD: 3,
}

/**
 * Groups an ordered list of blocks into display rows. A row holds only
 * same-width blocks (FULL alone; up to two HALFs; up to three THIRDs) and
 * closes as soon as it's full or the next block's width differs — a
 * same-width row that never fills (e.g. two THIRDs) is closed with its
 * leftover space unfilled rather than waiting for a same-width neighbor
 * later in the list. Pure function of the input order: callers persist only
 * a flat `position`, so reordering never needs a second write to fix up
 * row/column numbers. Runs identically in the Channel Designer's editor
 * preview and the public channel page's server render.
 */
export function packBlocks<T extends { width: ChannelBlockWidthInput }>(blocks: T[]): T[][] {
  const rows: T[][] = []
  let currentRow: T[] = []

  for (const block of blocks) {
    const sameWidthAsRow = currentRow[0]?.width === block.width
    if (currentRow.length > 0 && !sameWidthAsRow) {
      rows.push(currentRow)
      currentRow = []
    }

    currentRow.push(block)

    if (currentRow.length === MAX_PER_ROW[block.width]) {
      rows.push(currentRow)
      currentRow = []
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
}
