// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

const AUTH_ROUTES = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/verify',
  '/api/auth/setup-password',
]

/** Chat POST (token issuance, publish proxy) — strict limit; GET discovery stays on API limit. */
export function usesAuthRateLimit(url: string, method: string): boolean {
  if (AUTH_ROUTES.some((r) => url.startsWith(r))) return true
  return method === 'POST' && url.startsWith('/api/chat/')
}

/** Up to 100 releases × 50 tracks per request — same 120/min default bucket as
 * everything else would let a single account trigger tens of thousands of row
 * inserts per minute. */
export function isBulkImportRoute(url: string, method: string): boolean {
  const path = url.split('?')[0] ?? url
  return method === 'POST' && path === '/api/me/releases/import'
}

export type EditorRateLimitTier = 'heavy' | 'draft'

/** Expensive ffmpeg enqueue + autosave storm protection for archive editor. */
export function editorRateLimitTier(url: string, method: string): EditorRateLimitTier | null {
  const path = url.split('?')[0] ?? url
  if (!path.includes('/editor/')) return null
  if (method === 'POST' && path.endsWith('/editor/render')) {
    return 'heavy'
  }
  if (method === 'PATCH' && path.endsWith('/editor/draft')) return 'draft'
  return null
}
