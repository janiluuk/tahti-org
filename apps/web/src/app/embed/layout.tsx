// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { EmbedShell } from '@tahti/ui'
import '@tahti/ui/src/styles/embed.css'

/** Minimal chrome for iframe embeds (M14) — no site footer or navigation. */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <EmbedShell>{children}</EmbedShell>
}
