// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export function sessionCookieCandidates(
  rawCookieHeader: string | undefined,
  cookieName: string,
  parsedFallback?: string,
): string[] {
  const candidates: string[] = []

  for (const part of rawCookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue
    const rawValue = part.slice(separator + 1).trim()
    if (!rawValue) continue
    try {
      candidates.push(decodeURIComponent(rawValue))
    } catch {
      candidates.push(rawValue)
    }
  }

  if (parsedFallback) candidates.push(parsedFallback)
  return [...new Set(candidates)]
}
