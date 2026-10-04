// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { safeDisplayName } from '@tahti/shared'

type NamedUser = { username: string; displayName: string }

/** A user's public name, never an email address. */
export function userName(user: NamedUser): string {
  return safeDisplayName(user.displayName, user.username)
}

/** The same user with `displayName` replaced by its safe public name, for
 * responses that send the selected user object as-is. */
export function withSafeName<T extends NamedUser>(user: T): T {
  return { ...user, displayName: userName(user) }
}

/** Who a track is credited to: its own artist name, else the channel owner's
 * name, never an email address. */
export function trackArtistName(sound: {
  artistName: string | null
  channel: { user: NamedUser }
}): string {
  return safeDisplayName(sound.artistName, userName(sound.channel.user))
}
