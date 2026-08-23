'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect } from 'react'
import { StreamManagerPanel } from './_stream-manager-panel'
import { ChannelControlsPanel } from './channel-controls-panel'

/** Modal opened from the top-nav go-live icon, whatever the channel's state —
 * so you never have to leave the dashboard page you're on to check in. Shows
 * live stats+chat for a real broadcast, or rotation/playlist controls
 * (skip, drag-and-drop reorder, start/stop) otherwise. The dashboard home
 * page shows StreamManagerPanel inline for the live case instead (see
 * _channel-hero.tsx) since it's already the natural home for it there. */
export function StreamManagerModal({
  slug,
  displayName,
  open,
  onClose,
  isReallyLive,
}: {
  slug: string
  displayName?: string
  open: boolean
  onClose: () => void
  isReallyLive?: boolean
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="stream-mgr-modal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="stream-mgr-modal__card" role="dialog" aria-modal="true">
        <button
          type="button"
          className="stream-mgr-modal__close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        {isReallyLive ? (
          <StreamManagerPanel slug={slug} displayName={displayName} onEnded={onClose} />
        ) : (
          <ChannelControlsPanel slug={slug} />
        )}
      </div>
    </div>
  )
}
