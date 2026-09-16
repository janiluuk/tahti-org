'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { type DragEvent } from 'react'
import { AvatarTile, Spinner } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'

/** Thumbnail-only queue/history row — the redesigned queue panel shows
 * artwork alone (title is available via the native `title` tooltip) so
 * three columns (history / now playing / up next) fit side by side.
 * `loading` covers the rare case where the currently-loading track also
 * appears again later in the queue (e.g. a repeated track) — the common
 * case (the "Now playing" slot) is a separate, non-QueueThumb block in
 * mini-player.tsx, since `history`/`upNext` both exclude the current
 * track by construction otherwise. */
export function QueueThumb({
  item,
  active,
  loading,
  onPlay,
  onRemove,
  draggable,
  dragged,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: PlayerTrack
  active?: boolean
  loading?: boolean
  onPlay: () => void
  onRemove?: () => void
  draggable?: boolean
  dragged?: boolean
  dragOver?: boolean
  onDragStart?: () => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: () => void
  onDragEnd?: () => void
}) {
  return (
    <li
      className={`mini-player-queue__thumb-item${active ? ' mini-player-queue__thumb-item--active' : ''}${dragged ? ' mini-player-queue__thumb-item--dragging' : ''}${dragOver ? ' mini-player-queue__thumb-item--drag-over' : ''}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <button
        type="button"
        className="mini-player-queue__thumb-play"
        onClick={onPlay}
        aria-label={active ? `${item.title} — now playing` : `Skip to ${item.title}`}
        aria-current={active ? 'true' : undefined}
        title={item.subtitle ? `${item.title} — ${item.subtitle}` : item.title}
      >
        {item.artworkUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.artworkUrl} alt="" className="mini-player-queue__thumb-art" />
        ) : (
          <AvatarTile size="sm" name={item.title} className="mini-player-queue__thumb-art" />
        )}
        {loading && (
          <span className="mini-player-queue__thumb-loading">
            <Spinner size="sm" />
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          className="mini-player-queue__thumb-remove"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${item.title} from queue`}
          title="Remove from queue"
        >
          ✕
        </button>
      )}
    </li>
  )
}
