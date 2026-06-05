// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-studio.css'

/** Dashboard uses StudioShell from @tahti/ui (import brand-studio.css once here). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>
}
