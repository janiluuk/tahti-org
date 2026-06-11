// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { MetadataRoute } from 'next'
import { resolveAppUrl } from '@/lib/app-url'

const API_URL = process.env.API_URL ?? process.env.INTERNAL_API_BASE ?? 'http://localhost:3001'

async function fetchSitemapUrls(path: string): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const xml = await res.text()
    const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    return matches.map((m) => m[1]!)
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = resolveAppUrl()
  const [profiles, releases] = await Promise.all([
    fetchSitemapUrls('/api/sitemap/profiles.xml'),
    fetchSitemapUrls('/api/sitemap/releases.xml'),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/transparency`, changeFrequency: 'monthly', priority: 0.6 },
  ]

  const profileEntries: MetadataRoute.Sitemap = profiles.map((url) => ({
    url,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const releaseEntries: MetadataRoute.Sitemap = releases.map((url) => ({
    url,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...staticPages, ...profileEntries, ...releaseEntries]
}
