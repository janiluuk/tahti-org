// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

/** Verify page uses dark auth shell — no brand-public wrapper. */
export default function VerifyLayout({ children }: { children: ReactNode }) {
  return children
}
