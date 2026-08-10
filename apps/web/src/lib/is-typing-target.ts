// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** True when a keydown target is a place the user is typing — used to gate
 * global keyboard shortcuts (e.g. player controls) so they don't hijack Space
 * or arrow keys while someone is filling in a form or a rich-text field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (TYPING_TAGS.has(target.tagName)) return true
  return target.isContentEditable
}
