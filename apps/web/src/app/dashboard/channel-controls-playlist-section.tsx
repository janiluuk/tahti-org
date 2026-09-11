'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Button, SortableList } from '@tahti/ui'
import { itemTitle } from './channel-controls-utils'
import type {
  CollectionDetail,
  CollectionItem,
  PlaylistOption,
  ProgrammeItem,
} from './channel-controls-types'

export function ChannelControlsPlaylistSection({
  playlistSectionId,
  playlists,
  activePlaylist,
  rotationItems,
  collection,
  editableItems,
  pending,
  onPlaylistChange,
  onReorderCollection,
  onReorderDefault,
}: {
  playlistSectionId: string
  playlists: PlaylistOption[]
  activePlaylist: PlaylistOption | null
  rotationItems: ProgrammeItem[]
  collection: CollectionDetail | null
  editableItems: CollectionItem[] | ProgrammeItem[]
  pending: string | null
  onPlaylistChange: (collectionId: string) => void
  onReorderCollection: (next: CollectionItem[]) => void
  onReorderDefault: (next: ProgrammeItem[]) => void
}) {
  return (
    <div id={playlistSectionId} className="db-channel-controls__body">
      <label className="studio-label" htmlFor="dashboard-channel-playlist">
        Channel playlist
      </label>
      <select
        id="dashboard-channel-playlist"
        className="studio-input db-channel-controls__select"
        value={activePlaylist?.id ?? ''}
        disabled={pending !== null}
        onChange={(event) => onPlaylistChange(event.target.value)}
      >
        <option value="">Default rotation ({rotationItems.length})</option>
        {playlists.map((playlist) => (
          <option key={playlist.id} value={playlist.id}>
            {playlist.name} ({playlist.trackCount})
          </option>
        ))}
      </select>

      <div className="db-channel-controls__playlist-head">
        <strong>{activePlaylist?.name ?? 'Default rotation'}</strong>
        <a href="/dashboard/channel/playlist" className="studio-link">
          Edit full playlist
        </a>
      </div>
      {editableItems.length === 0 ? (
        <p className="studio-text-muted-sm studio-m-0">This playlist has no tracks yet.</p>
      ) : activePlaylist ? (
        <SortableList
          as="ol"
          className="db-channel-controls__playlist"
          items={collection?.items ?? []}
          itemId={(item) => item.id}
          onReorder={onReorderCollection}
          renderItem={(item, index, sortable) => (
            <li
              ref={sortable.ref}
              className={`db-channel-controls__track${sortable.isDragging ? ' is-dragging' : ''}`}
            >
              <button
                ref={sortable.handleRef}
                type="button"
                aria-label={`Reorder ${itemTitle(item)}`}
              >
                ⠿
              </button>
              <span>{index + 1}</span>
              <strong>{itemTitle(item)}</strong>
            </li>
          )}
        />
      ) : (
        <SortableList
          as="ol"
          className="db-channel-controls__playlist"
          items={rotationItems}
          itemId={(item) => item.id}
          onReorder={onReorderDefault}
          renderItem={(item, index, sortable) => (
            <li
              ref={sortable.ref}
              className={`db-channel-controls__track${sortable.isDragging ? ' is-dragging' : ''}`}
            >
              <button ref={sortable.handleRef} type="button" aria-label={`Reorder ${item.title}`}>
                ⠿
              </button>
              <span>{index + 1}</span>
              <strong>{item.title}</strong>
            </li>
          )}
        />
      )}
      {pending === 'reorder' ? <p className="studio-text-muted-sm">Saving order…</p> : null}
    </div>
  )
}

export function ChannelControlsPlaylistConfirm({
  pendingChoice,
  onReplace,
  onAppend,
  onCancel,
}: {
  pendingChoice: { id: string; name: string }
  onReplace: (id: string) => void
  onAppend: (id: string) => void
  onCancel: () => void
}) {
  return (
    <div
      className="db-channel-controls__confirm-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="db-channel-controls__confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label={`Use ${pendingChoice.name}`}
      >
        <h3 className="db-channel-controls__confirm-title">
          Use &ldquo;{pendingChoice.name}&rdquo;?
        </h3>
        <p className="studio-text-muted-sm">
          Replace swaps the whole rotation for this playlist. Append adds its tracks to the end of
          your current rotation instead.
        </p>
        <div className="db-channel-controls__confirm-actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onReplace(pendingChoice.id)
            }}
          >
            Replace
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onAppend(pendingChoice.id)
            }}
          >
            Append
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
