// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** M23: public RSS feed URLs (API base, not app base). */
export function artistArchiveRssUrl(apiUrl: string, username: string): string {
  return `${apiUrl.replace(/\/$/, '')}/api/v1/u/${encodeURIComponent(username)}/rss.xml`
}

export function channelArchiveRssUrl(apiUrl: string, channelSlug: string): string {
  return `${apiUrl.replace(/\/$/, '')}/api/v1/c/${encodeURIComponent(channelSlug)}/rss.xml`
}

export function collectionRssUrl(apiUrl: string, collectionSlug: string): string {
  return `${apiUrl.replace(/\/$/, '')}/api/v1/collections/${encodeURIComponent(collectionSlug)}/rss.xml`
}
