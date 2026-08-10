// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Purely a client-side UX signal — skip forcing the visitor through the
 * hCaptcha widget again on a fast return visit to the same channel's chat.
 * The server remains the actual authority: /api/chat/:slug/token independently
 * checks a Redis-backed record of the same "recently solved" fact keyed by an
 * IP+UA+channel fingerprint (see chat-captcha.ts) before accepting a join with
 * no fresh token, and will fall back to demanding a real captcha solve if that
 * check doesn't hold (different network, cache cleared, TTL elapsed, etc.) —
 * this local flag can't be used to forge a bypass, it only decides whether to
 * *attempt* a captcha-free join before asking the visitor to solve one.
 * TTL mirrors the server's chat-captcha.ts (24h). */
const TTL_MS = 24 * 60 * 60 * 1000

function storageKey(slug: string): string {
  return `tahti_chat_captcha_ok:${slug}`
}

export function markChatCaptchaVerifiedLocally(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(slug), String(Date.now()))
  } catch {
    /* storage unavailable (private mode, quota) — just re-prompt next time */
  }
}

/** Called when the server rejects a join with "hCaptcha verification failed"
 * despite this browser's local flag saying it was recently solved (different
 * network, cleared cache, TTL mismatch) — clears the stale flag so the next
 * attempt goes straight to the widget instead of retrying the same losing bet. */
export function clearChatCaptchaVerifiedLocally(slug: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(slug))
  } catch {
    /* nothing to clean up if storage is unavailable */
  }
}

export function wasChatCaptchaRecentlyVerified(slug: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem(storageKey(slug))
    const at = raw ? Number(raw) : NaN
    return Number.isFinite(at) && Date.now() - at < TTL_MS
  } catch {
    return false
  }
}
