// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

/** Apply uses the full-viewport auth-shell. The gateway background is the shared
 * global <BgCanvas> mounted once in the root layout (see PublicNavBg). */
export default function ApplyLayout({ children }: { children: ReactNode }) {
  return children
}
