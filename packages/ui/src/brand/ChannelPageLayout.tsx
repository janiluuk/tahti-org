// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { ReactNode } from 'react'

type ChannelHeaderProps = {
  isLive?: boolean
}

/** PLAT-020: sticky channel top bar — TAHTI logo + live indicator. */
export function ChannelHeader({ isLive }: ChannelHeaderProps) {
  return (
    <header className="ch-header">
      <Link href="/" className="ch-logo">
        TAHTI
      </Link>
      {isLive && (
        <div className="ch-live">
          <span className="signal-dot" aria-hidden />
          LIVE
        </div>
      )}
    </header>
  )
}

type ChannelPageLayoutProps = {
  isLive?: boolean
  main: ReactNode
  sidebar: ReactNode
}

/** PLAT-020: two-column channel layout (main + chat sidebar). */
export function ChannelPageLayout({ isLive, main, sidebar }: ChannelPageLayoutProps) {
  return (
    <>
      <ChannelHeader isLive={isLive} />
      <div className="ch-body">
        <div className="ch-main">{main}</div>
        <aside className="ch-sidebar">{sidebar}</aside>
      </div>
    </>
  )
}
