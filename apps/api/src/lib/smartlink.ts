// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

export const SMART_LINK_SERVICES = [
  'spotify',
  'apple',
  'tidal',
  'bandcamp',
  'soundcloud',
  'youtube',
  'deezer',
  'amazon',
  'mixcloud',
] as const

export type SmartLinkService = (typeof SMART_LINK_SERVICES)[number]

export function parseSmartLinkTargets(input: unknown): Record<string, string> | string {
  if (input === undefined || input === null) return {}
  if (typeof input !== 'object' || Array.isArray(input)) {
    return 'smartLinkTargets must be an object'
  }

  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!SMART_LINK_SERVICES.includes(key as SmartLinkService)) {
      return `Unknown service: ${key}`
    }
    if (value === '' || value === null) continue
    if (typeof value !== 'string' || !value.trim()) {
      return `${key} must be a URL string`
    }
    const url = value.trim()
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return `${key} must be an http(s) URL`
      }
    } catch {
      return `Invalid URL for ${key}`
    }
    out[key] = url
  }
  return out
}
