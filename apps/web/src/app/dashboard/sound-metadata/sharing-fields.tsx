// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { SectionProps, SoundMetadataFormState } from './types'

/** Who can hear it and how they can interact — everything defaults to the
 * artist-friendly setting (public, comments on, eligible for discovery). */
export function SoundSharingFields({
  state,
  onChange,
  disabled,
  itemId,
}: SectionProps & { itemId?: string }) {
  const set = (patch: Partial<SoundMetadataFormState>) => onChange({ ...state, ...patch })

  return (
    <div className="studio-row studio-row--wrap studio-gap-lg studio-text-sm">
      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={state.isPublic}
          disabled={disabled}
          onChange={(e) => set({ isPublic: e.target.checked })}
        />
        Public on channel
      </label>
      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={state.repostToDownload}
          disabled={disabled}
          onChange={(e) => set({ repostToDownload: e.target.checked })}
        />
        Repost to download
      </label>
      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={state.followToDownload}
          disabled={disabled}
          onChange={(e) => set({ followToDownload: e.target.checked })}
        />
        Follow to download
      </label>
      <label
        className="studio-label-row"
        title="Enter the weekly Tahti Selects rotation draw — up to 3 of your opted-in tracks can be picked per week"
      >
        <input
          type="checkbox"
          checked={state.selectsOptIn}
          disabled={disabled}
          onChange={(e) => set({ selectsOptIn: e.target.checked })}
        />
        Eligible for Tahti Selects
      </label>
      {itemId && (
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.commentsEnabled}
            disabled={disabled}
            onChange={(e) => set({ commentsEnabled: e.target.checked })}
          />
          Allow comments on this track
        </label>
      )}
      {itemId && (
        <label className="studio-label-row">
          <input
            type="checkbox"
            checked={state.topListsEligible}
            disabled={disabled}
            onChange={(e) => set({ topListsEligible: e.target.checked })}
          />
          Include in top lists
        </label>
      )}
    </div>
  )
}
