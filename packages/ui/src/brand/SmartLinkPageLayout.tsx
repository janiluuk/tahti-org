// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader } from './ChannelPageLayout'

type SmartLinkPageLayoutProps = {
  children: ReactNode
  /** Artist back link in header centre — reference: "← dj-moonrise" */
  contextLink?: { href: string; label: string }
}

/** PLAT-020: centered smart link landing (/r/[slug]) — shell-narrow, max 460px. */
export function SmartLinkPageLayout({ children, contextLink }: SmartLinkPageLayoutProps) {
  return (
    <>
      <ChannelHeader contextLink={contextLink} />
      <div className="sl-wrap shell-narrow">{children}</div>
    </>
  )
}
