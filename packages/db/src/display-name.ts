// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Mirrors safeDisplayName in @tahti/shared, which this package can't import
// (@tahti/shared depends on @tahti/db). display-name-parity.test.ts in
// @tahti/shared keeps the two in step.
const EMAIL_PATTERN = /[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}/i

/** A user's public name for stored text such as notification titles: their
 * display name, or their username when it is empty or contains an email address. */
export function actorDisplayName(user: { username: string; displayName: string | null }): string {
  const trimmed = user.displayName?.trim() ?? ''
  return trimmed && !EMAIL_PATTERN.test(trimmed) ? trimmed : user.username
}
