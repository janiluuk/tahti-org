// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ImportPluginProvider } from '@tahti/shared'
import { IMPORT_PLUGIN_CONTRACT_VERSION } from '@tahti/shared'

/**
 * Core-owned provider metadata for Tahti Player / Nuclear clients.
 * Configuration UI stays in the player Configure modal; this registry
 * deliberately contains no credentials or per-user state.
 *
 * Keep kinds separate: OAuth, search, and tool/upload adapters are not one
 * universal start/status/import interface. Export/DSP delivery is
 * `GET /api/me/export-plugins` — see `export-plugin-providers.ts`.
 *
 * Capability flags must match real routes: never advertise import/fileList/
 * search with a null or phantom path.
 */
export const IMPORT_PLUGIN_PROVIDERS: ImportPluginProvider[] = [
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'google-drive',
    name: 'Google Drive',
    description:
      "Import audio files from the artist's Google Drive (Picker UI via /api/me/google-drive/picker-config, then import job).",
    kind: 'oauth',
    capabilities: {
      configure: true,
      connectionTest: true,
      // File picking is Google Picker (not a REST listPath); see picker-config.
      fileList: false,
      import: true,
      search: false,
      playback: false,
    },
    oauthStartPath: '/api/me/google-drive/oauth/start',
    statusPath: '/api/me/google-drive',
    listPath: null,
    importPath: '/api/me/google-drive/import',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'bandcamp',
    name: 'Bandcamp',
    description:
      'Connect Bandcamp. Album listing is a stub until Bandcamp API v1; catalog import is not wired yet.',
    kind: 'oauth',
    capabilities: {
      configure: true,
      connectionTest: true,
      fileList: true,
      import: false,
      search: false,
      playback: true,
    },
    oauthStartPath: '/api/me/bandcamp/oauth/start',
    statusPath: '/api/me/bandcamp',
    listPath: '/api/me/bandcamp/albums',
    importPath: null,
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'soundcloud',
    name: 'SoundCloud',
    description: 'OAuth connect, list downloadable tracks, queue server-side import to archive.',
    kind: 'oauth',
    capabilities: {
      configure: true,
      connectionTest: true,
      fileList: true,
      import: true,
      search: false,
      playback: false,
    },
    oauthStartPath: '/api/me/soundcloud/oauth/start',
    statusPath: '/api/me/soundcloud',
    listPath: '/api/me/soundcloud/tracks',
    importPath: '/api/me/soundcloud/import',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'mixcloud',
    name: 'Mixcloud',
    description:
      'Connect Mixcloud to upload archive mixes to Mixcloud (POST /api/me/sound/:itemId/mixcloud). Catalog import is separate embed search.',
    kind: 'oauth',
    capabilities: {
      configure: true,
      connectionTest: true,
      fileList: false,
      import: false,
      search: false,
      playback: false,
    },
    oauthStartPath: '/api/me/mixcloud/oauth/start',
    statusPath: '/api/me/mixcloud',
    listPath: null,
    importPath: null,
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'spotify',
    name: 'Spotify search',
    description: 'Search Spotify tracks (app token) to add into mixed-source collections.',
    kind: 'search',
    capabilities: {
      configure: true,
      connectionTest: true,
      fileList: false,
      import: true,
      search: true,
      playback: true,
    },
    oauthStartPath: null,
    statusPath: '/api/me/spotify-profile',
    searchPath: '/api/v1/imports/spotify/search',
    importPath: '/api/v1/imports/spotify/add',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'hearthis',
    name: 'hearthis.at',
    description:
      "Search hearthis.at's public catalogue and queue tracks as provider-hosted embeds.",
    kind: 'search',
    capabilities: {
      configure: true,
      connectionTest: false,
      fileList: false,
      import: true,
      search: true,
      playback: true,
    },
    oauthStartPath: null,
    statusPath: null,
    searchPath: '/api/v1/imports/hearthis/search',
    importPath: '/api/v1/imports/hearthis/add',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'mixcloud-embed',
    name: 'Mixcloud search',
    description:
      'Search Mixcloud cloudcasts and add them as provider-hosted embeds (no audio re-host). Distinct from Mixcloud OAuth upload/rescue.',
    kind: 'search',
    capabilities: {
      configure: false,
      connectionTest: false,
      fileList: false,
      import: true,
      search: true,
      playback: true,
    },
    oauthStartPath: null,
    statusPath: null,
    searchPath: '/api/v1/imports/mixcloud/search',
    importPath: '/api/v1/imports/mixcloud/add',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'upload',
    name: 'Local upload',
    description: 'Upload audio files into the archive (prepare → object store → complete).',
    kind: 'upload',
    capabilities: {
      configure: false,
      connectionTest: false,
      fileList: false,
      import: true,
      search: false,
      playback: true,
    },
    oauthStartPath: null,
    statusPath: null,
    importPath: '/api/uploads/prepare',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'stash',
    name: 'Stash',
    description: 'Private file locker — upload stems/masters without publishing to the channel.',
    kind: 'upload',
    capabilities: {
      configure: false,
      connectionTest: true,
      fileList: true,
      import: true,
      search: false,
      playback: false,
    },
    oauthStartPath: null,
    statusPath: '/api/me/stash',
    listPath: '/api/me/stash',
    // Stash upload uses the same prepare/complete upload flow as local upload.
    importPath: '/api/uploads/prepare',
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'url',
    name: 'URL / DSP paste',
    description: 'Paste Spotify/Bandcamp/etc. URLs to seed smart-link targets on a release.',
    kind: 'tool',
    capabilities: {
      configure: false,
      connectionTest: false,
      fileList: false,
      import: false,
      search: false,
      playback: false,
    },
    oauthStartPath: null,
    statusPath: null,
  },
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'radio',
    name: 'Internet radio',
    description:
      'Paste an M3U/M3U8 playlist or direct stream URL to play a station (client-side; no search API).',
    kind: 'tool',
    capabilities: {
      configure: false,
      connectionTest: false,
      fileList: false,
      import: false,
      search: false,
      playback: true,
    },
    oauthStartPath: null,
    statusPath: null,
    searchPath: null,
  },
]
