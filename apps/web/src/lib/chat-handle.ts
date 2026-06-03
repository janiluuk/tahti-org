// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** LISTENER-003: shared key for chat display name persistence. */
export const CHAT_HANDLE_STORAGE_KEY = 'tahti_chat_handle'

export const CHAT_HANDLE_COOKIE = 'tahti_chat_handle'

/** Read handle from document.cookie (client only). */
export function readChatHandleCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CHAT_HANDLE_COOKIE}=([^;]*)`))
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1]).trim().slice(0, 32) || null
  } catch {
    return null
  }
}

/** Persist handle in localStorage and rely on API Set-Cookie when joining chat. */
export function persistChatHandle(handle: string): void {
  const clean = handle.trim().slice(0, 32)
  if (!clean) return
  localStorage.setItem(CHAT_HANDLE_STORAGE_KEY, clean)
}

/** Prefer localStorage, then cookie — survives cleared storage when cookie remains. */
export function loadStoredChatHandle(): string | null {
  if (typeof window === 'undefined') return null
  const fromStorage = localStorage.getItem(CHAT_HANDLE_STORAGE_KEY)?.trim()
  if (fromStorage) return fromStorage.slice(0, 32)
  return readChatHandleCookie()
}
