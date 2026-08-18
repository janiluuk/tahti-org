'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect } from 'react'
import { StreamManagerPanel } from './_stream-manager-panel'

/** Modal chrome around StreamManagerPanel — opened from the top-nav go-live
 * icon once you're on air, so you don't have to leave whatever dashboard
 * page you're on to check in. The dashboard home page shows the same panel
 * inline instead (see _channel-hero.tsx) since it's already the natural
 * home for it there. */
export function StreamManagerModal({
  slug,
  displayName,
  open,
  onClose,
}: {
  slug: string
  displayName?: string
  open: boolean
  onClose: () => void
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
        <StreamManagerPanel slug={slug} displayName={displayName} onEnded={onClose} />
      </div>
    </div>
  )
}
