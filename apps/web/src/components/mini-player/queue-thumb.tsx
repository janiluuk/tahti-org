'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { type DragEvent } from 'react'
import { AvatarTile } from '@tahti/ui'
import type { PlayerTrack } from '@/contexts/player-context'

/** Thumbnail-only queue/history row — the redesigned queue panel shows
 * artwork alone (title is available via the native `title` tooltip) so
 * three columns (history / now playing / up next) fit side by side. */
export function QueueThumb({
  item,
  active,
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
