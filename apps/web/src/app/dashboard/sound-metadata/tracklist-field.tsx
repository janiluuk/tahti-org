// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { TracklistEditor } from '../tracklist-editor'
import type { SectionProps } from './types'

/** Tracklist — its own tab since a multi-track DJ set can have dozens of entries. */
export function SoundTracklistField({ state, onChange, disabled }: SectionProps) {
  return (
    <TracklistEditor
      value={state.tracklist}
      onChange={(tracklist) => onChange({ ...state, tracklist })}
      disabled={disabled}
    />
  )
}
