// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

export function MobileDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const sync = () => setOpen(!media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  return (
    <details
      className="listen-mobile-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      <div className="listen-mobile-disclosure__content">{children}</div>
    </details>
  )
}
