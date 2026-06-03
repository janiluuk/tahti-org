// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@/components/brand-public.css'

export default function SmartLinkLayout({ children }: { children: ReactNode }) {
  return <div data-tahti-ui="brand">{children}</div>
}
