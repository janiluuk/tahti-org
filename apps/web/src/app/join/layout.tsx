// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@/lib/import-public-brand-css'

export default function JoinLayout({ children }: { children: ReactNode }) {
  return <PublicBrandShell center>{children}</PublicBrandShell>
}
