// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Server-side API origin (RSC, middleware, server actions). */
export function resolveServerApiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3001'
}

/** Browser-reachable API origin (client components). */
export function resolveClientApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    'http://localhost:3001'
  )
}
