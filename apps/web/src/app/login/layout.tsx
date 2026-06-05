// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

/** Login uses full-viewport auth-shell + BgCanvas — no brand-public wrapper. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
