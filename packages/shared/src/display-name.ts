// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const EMAIL_PATTERN = /[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}/i

/** True when the text contains an email address anywhere in it. */
export function containsEmailAddress(text: string): boolean {
  return EMAIL_PATTERN.test(text)
}

export const DISPLAY_NAME_EMAIL_MESSAGE = "Display name can't contain an email address"

/**
 * Display names are public (artist and channel names, credits, chat), so they
 * must never carry an email address. Falls back to the username when the
 * candidate is empty or contains one.
 */
export function safeDisplayName(candidate: string | null | undefined, username: string): string {
  const trimmed = candidate?.trim() ?? ''
  return trimmed && !containsEmailAddress(trimmed) ? trimmed : username
}
