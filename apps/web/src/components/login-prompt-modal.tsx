// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Shown in place of a hard redirect when an anonymous listener clicks a
 * gated action (love, repost, download, add to playlist) — keeps them on the
 * page (and keeps whatever's playing in the shared PlayerProvider alive)
 * instead of tearing down the tab with a full navigation to /login. */
export function LoginPromptModal({
  message = 'Sign in to continue.',
  onClose,
}: {
  message?: string
  onClose: () => void
}) {
  const pathname = usePathname()
  return (
    <div
      className="prof-embed-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in required"
      onClick={onClose}
    >
      <div className="prof-embed-modal prof-login-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prof-embed-modal__header">
          <h3 className="prof-embed-modal__title">Sign in required</h3>
          <button
            type="button"
            className="prof-embed-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="prof-embed-modal__body">
          <p className="prof-login-modal__text">{message}</p>
          <Link
            href={`/login?next=${encodeURIComponent(pathname || '/')}`}
            className="prof-cta-btn prof-login-modal__cta"
            onClick={onClose}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
