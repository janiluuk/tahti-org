// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Escape user-authored text for safe HTML rendering (plain text / line breaks only). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Render escaped plain text with preserved line breaks. */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br />')
}

const MENTION_HANDLE = /@([a-z0-9_-]{2,32})/gi

/** Phase 10 — link @handles to public profiles (text must be escaped first). */
export function plainTextWithMentionsToHtml(text: string, profilePathPrefix = '/u'): string {
  return plainTextToHtml(text).replace(
    MENTION_HANDLE,
    (_match, handle: string) =>
      `<a href="${profilePathPrefix}/${handle.toLowerCase()}" class="mention-link">@${handle}</a>`,
  )
}
