'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createContext, useContext } from 'react'

/** Lets any dashboard page (e.g. the "On air" pill on the overview page)
 * open the same stream manager modal the top-nav go-live icon does, without
 * threading the open-state through every page — the modal itself lives in
 * _studio-shell-client.tsx, which provides this. Null outside that tree. */
export const StreamManagerContext = createContext<(() => void) | null>(null)

export function useStreamManager(): (() => void) | null {
  return useContext(StreamManagerContext)
}
