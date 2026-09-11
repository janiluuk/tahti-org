// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ScheduledLiveShowView } from '@tahti/shared'

// Sun(0)..Sat(6) order to match WEEKDAY_LABELS/JS Date#getDay, but the button
// row itself reads left-to-right starting Monday — how artists actually think
// about a weekly show schedule.
export const FREQUENCY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function sortShows(left: ScheduledLiveShowView, right: ScheduledLiveShowView) {
  return new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
}

export function formatPreviewLabel(at: string, note: string): string {
  const previewAtIso = at ? new Date(at).toISOString() : null
  const previewNote = note.trim() || null

  return [
    previewNote,
    previewAtIso
      ? new Date(previewAtIso).toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
