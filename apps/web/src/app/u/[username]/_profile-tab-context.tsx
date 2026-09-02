// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { createContext, useContext } from 'react'
import type { ProfileTabId } from './_profile-tabs'

/** Lets content nested inside a ProfileTabs panel (e.g. a track detail modal
 * opened from the Music tab) switch to another tab client-side, without a
 * page navigation — provided by ProfileTabs itself, consumed from wherever
 * needs it regardless of which server component originally authored that
 * JSX (Context resolves against the live render tree, not the panel's
 * source file). */
const ProfileTabSwitchContext = createContext<((tab: ProfileTabId) => void) | null>(null)

export const ProfileTabSwitchProvider = ProfileTabSwitchContext.Provider

/** Returns a function to switch the profile's active tab, or null if called
 * outside ProfileTabs (callers should fall back to a normal Link in that case). */
export function useSwitchProfileTab(): ((tab: ProfileTabId) => void) | null {
  return useContext(ProfileTabSwitchContext)
}
