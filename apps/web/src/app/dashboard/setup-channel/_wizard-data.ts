// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { parseSocialLinksGenres } from '@tahti/shared'
import { dashboardSessionCookie } from '@/lib/dashboard-session'
import { resolveServerApiUrl } from '@/lib/api-url'

export interface WizardProfile {
  bio: string
  genres: string[]
  topListsOptOut: boolean
}

/** Server-side read of what the wizard prefills; falls back to empty defaults on any failure. */
export async function loadWizardProfile(): Promise<WizardProfile> {
  const session = dashboardSessionCookie()
  const empty: WizardProfile = { bio: '', genres: [], topListsOptOut: false }
  if (!session) return empty
  const apiUrl = resolveServerApiUrl()
  const headers = { Cookie: `tahti_session=${session}` }
  try {
    const [profileRes, optOutRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/profile`, { headers, cache: 'no-store' }),
      fetch(`${apiUrl}/api/me/top-lists-opt-out`, { headers, cache: 'no-store' }),
    ])
    const profile = profileRes.ok
      ? ((await profileRes.json()) as { bio: string | null; socialLinks: unknown })
      : null
    const optOut = optOutRes.ok ? ((await optOutRes.json()) as { topListsOptOut: boolean }) : null
    return {
      bio: profile?.bio ?? '',
      genres: parseSocialLinksGenres(profile?.socialLinks),
      topListsOptOut: optOut?.topListsOptOut ?? false,
    }
  } catch {
    return empty
  }
}
