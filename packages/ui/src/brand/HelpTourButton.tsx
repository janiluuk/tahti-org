'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { GuidedTour, type TourStep } from './GuidedTour'

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.1 6.2a1.9 1.9 0 1 1 2.9 1.6c-.6.4-1 .7-1 1.4v.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.6" r="0.9" fill="currentColor" />
    </svg>
  )
}

/** Top-bar help icon — starts a GuidedTour over the page's essential elements.
 * `steps` should already be scoped to the current page (see tour-steps.ts). */
export function HelpTourButton({ steps, className }: { steps: TourStep[]; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={className ?? 'studio-top-nav__icon-btn'}
        aria-label="Help — take a guided tour of this page"
        title="Help"
        onClick={() => setOpen(true)}
      >
        <IconHelp />
      </button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} />}
    </>
  )
}
