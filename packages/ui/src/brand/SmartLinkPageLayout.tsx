// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader } from './ChannelPageLayout'

/** PLAT-020: centered smart link landing (/r/[slug]). */
export function SmartLinkPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ChannelHeader />
      <div className="sl-wrap">{children}</div>
    </>
  )
}
