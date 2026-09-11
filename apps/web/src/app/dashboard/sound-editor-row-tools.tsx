// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import NextLink from 'next/link'
import { ButtonIcon, Button } from '@tahti/ui'
import { AddToPlaylistButton } from './_add-to-playlist-button'
import { IconPin, IconRotation, IconInsights, IconTools } from './sound-editor-icons'

/** Pin / rotation / add-to-playlist stay one-click; edit-oriented actions
 * (details, audio editor, insights) group under this "Tools" disclosure so
 * the row's icon cluster doesn't sprawl. Rendered inline with the playback
 * row's own icons (love/queue/download/repost/comment/report) so management
 * and listening actions read as a single button row instead of two. */
export function RowToolsActions({
  itemId,
  hasEmbed,
  pinned,
  pinPending,
  togglePin,
  inRotation,
  rotationPending,
  toggleRotation,
  onEditDetails,
}: {
  itemId: string
  hasEmbed: boolean
  pinned: boolean
  pinPending: boolean
  togglePin: () => void
  inRotation: boolean
  rotationPending: boolean
  toggleRotation: () => void
  onEditDetails: () => void
}) {
  return (
    <>
      <Button
        onClick={togglePin}
        disabled={pinPending}
        variant="ghost"
        size="sm"
        className="ui-btn--icon"
        title={pinned ? 'Unpin from Stage' : 'Pin to Stage'}
        aria-label={pinned ? 'Unpin from Stage' : 'Pin to Stage'}
      >
        <IconPin filled={pinned} />
      </Button>
      <Button
        onClick={toggleRotation}
        disabled={rotationPending}
        variant="ghost"
        size="sm"
        className="ui-btn--icon"
        title={inRotation ? 'Remove from rotation' : 'Add to rotation'}
        aria-label={inRotation ? 'Remove from rotation' : 'Add to rotation'}
      >
        <IconRotation active={inRotation} />
      </Button>
      <AddToPlaylistButton soundId={itemId} variant="icon" />
      <details className="sound-list__tools">
        <summary
          className="ui-btn ui-btn--sm ui-btn--ghost ui-btn--icon"
          title="Tools"
          aria-label="Tools"
        >
          <IconTools />
        </summary>
        <div className="sound-list__tools-menu" role="menu">
          <button type="button" role="menuitem" onClick={onEditDetails}>
            <ButtonIcon name="edit" />
            Edit details
          </button>
          {!hasEmbed && (
            <NextLink href={`/dashboard/sounds/${itemId}/editor`} role="menuitem">
              <ButtonIcon name="edit" />
              Audio editor
            </NextLink>
          )}
          <NextLink href={`/dashboard/insights/sound/${itemId}`} role="menuitem">
            <IconInsights />
            Insights
          </NextLink>
        </div>
      </details>
    </>
  )
}
