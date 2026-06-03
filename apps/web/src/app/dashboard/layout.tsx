// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioShell } from '@/components/studio-shell'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <StudioShell>{children}</StudioShell>
}
