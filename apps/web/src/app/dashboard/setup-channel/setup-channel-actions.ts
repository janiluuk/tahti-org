// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { updateChannelProfile } from '../channel-identity-actions'
import { updateTopListsOptOut } from '../discovery-settings-actions'

export async function provisionChannel(): Promise<{ error?: string; slug?: string }> {
  const session = cookies().get('tahti_session')
  if (!session) return { error: 'Not signed in' }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/me/channel/provision`, {
    method: 'POST',
    headers: { Cookie: `tahti_session=${session.value}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? `HTTP ${res.status}` }
  }
  const body = (await res.json()) as { slug: string }
  return { slug: body.slug }
}

/** Wizard step 1: provision the channel if needed, then write name + description to the profile
 * (channel name/bio live on the user profile, so no new API surface). */
export async function saveChannelIdentity(input: {
  displayName: string
  bio: string
  createChannel: boolean
}): Promise<{ error: string | null }> {
  if (input.createChannel) {
    const provisioned = await provisionChannel()
    // A retry after a failed profile write finds the channel already provisioned — that's fine.
    if (provisioned.error && provisioned.error !== 'Channel already exists.') {
      return { error: provisioned.error }
    }
  }
  return updateChannelProfile({ displayName: input.displayName, bio: input.bio })
}

/** Wizard step 2: genres live inside the profile's `socialLinks` bag, which PATCH replaces
 * wholesale — so read it first and merge, or returning to this step would wipe the user's links. */
export async function saveChannelGenresAndListing(input: {
  genres: string[]
  listed: boolean
}): Promise<{ error: string | null }> {
  const session = cookies().get('tahti_session')
  if (!session) return { error: 'Not signed in' }
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  const current = await fetch(`${apiUrl}/api/me/profile`, {
    headers: { Cookie: `tahti_session=${session.value}` },
    cache: 'no-store',
  })
  if (!current.ok) return { error: 'Could not load your profile' }
  const { socialLinks } = (await current.json()) as { socialLinks: Record<string, string> | null }

  const profile = await updateChannelProfile({
    socialLinks: { ...(socialLinks ?? {}), genres: input.genres.join(', ') },
  })
  if (profile.error) return profile
  // "List my channel" is the inverse of the existing top-lists opt-out — no new flag.
  return updateTopListsOptOut(!input.listed)
}
