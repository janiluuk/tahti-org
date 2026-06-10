// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Deterministic chat handle color variants (v8 palette). */
export const CHAT_HANDLE_VARIANTS = [
  'cyan',
  'amber',
  'purple',
  'green',
  'pink',
  'orange',
  'blue',
  'light-purple',
] as const

export type ChatHandleVariant = (typeof CHAT_HANDLE_VARIANTS)[number]

/** Same handle always maps to the same color across sessions. */
export function chatHandleVariant(handle: string): ChatHandleVariant {
  let hash = 0
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) >>> 0
  }
  return CHAT_HANDLE_VARIANTS[hash % CHAT_HANDLE_VARIANTS.length]!
}
