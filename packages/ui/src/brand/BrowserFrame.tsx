// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

type BrowserFrameProps = {
  url?: string
  children: ReactNode
  className?: string
}

export function BrowserFrame({ url = 'tahti.live', children, className }: BrowserFrameProps) {
  return (
    <div className={['browser-frame', className].filter(Boolean).join(' ')}>
      <div className="browser-frame__chrome">
        <span className="browser-frame__dot browser-frame__dot--red" aria-hidden />
        <span className="browser-frame__dot browser-frame__dot--yellow" aria-hidden />
        <span className="browser-frame__dot browser-frame__dot--green" aria-hidden />
        <span className="browser-frame__url">{url}</span>
      </div>
      <div className="browser-frame__content">{children}</div>
    </div>
  )
}
