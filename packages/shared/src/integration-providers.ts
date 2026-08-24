// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Single source of truth for the "install a plugin" import/export/
// fingerprinting integrations: the backend validates installs against this,
// and the frontend renders the marketplace from it. Adding a provider later
// is one array entry here, not a migration.

export type IntegrationScope = 'IMPORT' | 'EXPORT' | 'FINGERPRINT'
export type IntegrationAuthKind = 'API_KEY' | 'OAUTH'

export interface IntegrationField {
  key: string
  label: string
  secret?: boolean
}

export interface IntegrationProvider {
  slug: string
  name: string
  description: string
  scope: IntegrationScope
  authKind: IntegrationAuthKind
  /** API_KEY kind only. Empty array means "just enable, no fields to collect". */
  fields?: IntegrationField[]
  /** OAUTH kind only — the existing connect route to redirect to. */
  oauthConnectPath?: string
  /** OAUTH kind only — the User column that's non-null once connected. */
  oauthStatusField?: string
}

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    slug: 'spotify',
    name: 'Spotify',
    description: 'Search and import tracks from Spotify using your own developer app credentials.',
    scope: 'IMPORT',
    authKind: 'API_KEY',
    fields: [
      { key: 'clientId', label: 'Client ID' },
      { key: 'clientSecret', label: 'Client secret', secret: true },
    ],
  },
  {
    slug: 'hearthis-import',
    name: 'hearthis.at',
    description: 'Search and import tracks from hearthis.at (public catalog, no key required).',
    scope: 'IMPORT',
    authKind: 'API_KEY',
    fields: [],
  },
  {
    slug: 'mixcloud-import',
    name: 'Mixcloud',
    description: 'Search and import cloudcasts from Mixcloud (public catalog, no key required).',
    scope: 'IMPORT',
    authKind: 'API_KEY',
    fields: [],
  },
  {
    slug: 'soundcloud',
    name: 'SoundCloud',
    description: 'Connect your SoundCloud account to import your own tracks.',
    scope: 'IMPORT',
    authKind: 'OAUTH',
    oauthConnectPath: '/api/me/soundcloud/connect',
    oauthStatusField: 'soundcloudAccessTokenEnc',
  },
  {
    slug: 'google-drive',
    name: 'Google Drive',
    description: 'Connect Google Drive to import audio files from your own storage.',
    scope: 'IMPORT',
    authKind: 'OAUTH',
    oauthConnectPath: '/api/me/google-drive/connect',
    oauthStatusField: 'googleDriveAccessTokenEnc',
  },
  {
    slug: 'hearthis-export',
    name: 'hearthis.at',
    description: 'Push a track from your Tahti library out to your own hearthis.at account.',
    scope: 'EXPORT',
    authKind: 'API_KEY',
    fields: [{ key: 'apiKey', label: 'hearthis.at API key', secret: true }],
  },
  {
    slug: 'acoustid',
    name: 'AcoustID',
    description: 'Use your own AcoustID API key for track fingerprint checks in the Studio editor.',
    scope: 'FINGERPRINT',
    authKind: 'API_KEY',
    fields: [{ key: 'apiKey', label: 'AcoustID API key', secret: true }],
  },
  {
    slug: 'acrcloud',
    name: 'ACRCloud',
    description: 'Use your own ACRCloud project to identify tracks during live broadcasts.',
    scope: 'FINGERPRINT',
    authKind: 'API_KEY',
    fields: [
      { key: 'host', label: 'Host' },
      { key: 'accessKey', label: 'Access key', secret: true },
      { key: 'accessSecret', label: 'Access secret', secret: true },
    ],
  },
]

export function findIntegrationProvider(slug: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.slug === slug)
}
