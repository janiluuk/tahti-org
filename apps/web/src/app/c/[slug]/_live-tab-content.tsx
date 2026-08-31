// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

/** The channel's public Live content. Stream controls belong in the dashboard,
 * so the broken owner-only Stream manager sub-tab is not exposed here. */
export function LiveTabContent({
  listenContent,
}: {
  /** The existing public player/tracklist content — unchanged for visitors. */
  listenContent: ReactNode
}) {
  return <>{listenContent}</>
}
