// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useId, useState, type ReactNode } from 'react'

/** Collapsible help layer — instructional copy lives here, not inline on forms. */
export function DesignerHelpLayer({
  title = 'Help',
  children,
  defaultOpen = false,
}: {
  title?: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className="studio-designer-help">
      <button
        type="button"
        className="studio-designer-help__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="studio-designer-help__mark" aria-hidden>
          ?
        </span>
        {open ? 'Hide help' : title}
      </button>
      {open ? (
        <div
          id={panelId}
          className="studio-designer-help__body"
          role="region"
          aria-label="Section help"
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
