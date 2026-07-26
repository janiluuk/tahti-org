// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

/** Login uses the full-viewport auth-shell, no brand-public wrapper. The gateway
 * background is the shared global <BgCanvas> mounted once in the root layout
 * (see PublicNavBg) so it doesn't reinitialize switching between login/register/2FA. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return children
}
