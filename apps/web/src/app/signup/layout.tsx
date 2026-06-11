// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@tahti/ui/src/styles/brand-public.css'
import '@tahti/ui/src/styles/shells.css'

/** Signup wizard — shell-narrow. */
export default function SignupLayout({ children }: { children: ReactNode }) {
  return <PublicBrandShell center>{children}</PublicBrandShell>
}
