// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@/lib/import-public-brand-css'
import { BgCanvas } from '@/components/ui/bg-canvas'

export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <PublicBrandShell center background={<BgCanvas variant="subtle" />}>
      {children}
    </PublicBrandShell>
  )
}
