// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { shouldShowTracklist } from '../sound-editor-visibility'
import { SoundBasicsFields } from './basics-fields'
import { SoundVisualsFields } from './visuals-fields'
import { SoundSharingFields } from './sharing-fields'
import { SoundAdvancedFields } from './advanced-fields'
import { SoundTracklistField } from './tracklist-field'
import type { SoundMetadataFormState } from './types'

/** Full flowing form — every section in one column, used by the upload wizard
 * where there's no tabbed editor chrome yet (a track doesn't exist to switch
 * "tabs" on until it's actually uploaded). */
export function SoundMetadataFields({
  state,
  onChange,
  disabled,
  detectedBpm,
  detectedKey,
  itemId,
}: {
  state: SoundMetadataFormState
  onChange: (next: SoundMetadataFormState) => void
  disabled?: boolean
  detectedBpm?: number | null
  detectedKey?: string | null
  itemId?: string
}) {
  return (
    <div className="studio-grid studio-mt-md">
      <SoundBasicsFields state={state} onChange={onChange} disabled={disabled} itemId={itemId} />
      {shouldShowTracklist(state.contentType) && (
        <details className="studio-details-block" open>
          <summary className="studio-details-block__summary">Tracklist</summary>
          <div className="studio-details-block__body">
            <SoundTracklistField state={state} onChange={onChange} disabled={disabled} />
          </div>
        </details>
      )}
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Cover &amp; visuals</summary>
        <div className="studio-details-block__body">
          <SoundVisualsFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            itemId={itemId}
          />
        </div>
      </details>
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Visibility &amp; discovery</summary>
        <div className="studio-details-block__body">
          <SoundSharingFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            itemId={itemId}
          />
        </div>
      </details>
      <details className="studio-details-block">
        <summary className="studio-details-block__summary">Advanced</summary>
        <div className="studio-details-block__body">
          <SoundAdvancedFields
            state={state}
            onChange={onChange}
            disabled={disabled}
            detectedBpm={detectedBpm}
            detectedKey={detectedKey}
          />
        </div>
      </details>
    </div>
  )
}
