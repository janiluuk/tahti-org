// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/styles/embed.css'

/**
 * Minimal chrome for iframe embeds (M14) — no site footer or navigation.
 * Each page renders its own <EmbedShell> (rather than wrapping it here) so it
 * can pass per-embed options (e.g. transparent background) read from its own
 * searchParams — layouts don't receive searchParams in the App Router.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
