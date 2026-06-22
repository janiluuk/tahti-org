// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PageShell } from '@tahti/ui'
import { SettingsSubnav } from './_settings-subnav'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell size="md">
      <SettingsSubnav />
      {children}
    </PageShell>
  )
}
