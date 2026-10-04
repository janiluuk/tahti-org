// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The parsers live in @tahti/shared so the API's public now-playing route
// and this worker's sync job read station pages the same way.
export { fetchNowPlaying, parserForUrl, type NowPlaying } from '@tahti/shared'
