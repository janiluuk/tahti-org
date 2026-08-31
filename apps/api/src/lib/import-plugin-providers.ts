// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ImportPluginProvider } from '@tahti/shared'
import { IMPORT_PLUGIN_CONTRACT_VERSION } from '@tahti/shared'

/**
 * Core-owned provider metadata. Configuration controls remain in Nuclear's
 * plugin Configure modal; this registry deliberately contains no credentials.
 */
export const IMPORT_PLUGIN_PROVIDERS: ImportPluginProvider[] = [
  {
    contractVersion: IMPORT_PLUGIN_CONTRACT_VERSION,
    id: 'google-drive',
    name: 'Google Drive',
    description: "Import audio files from the artist's Google Drive.",
    kind: 'oauth',
    capabilities: {
      configure: true,
      connectionTest: true,
      fileList: true,
      import: true,
    },
    oauthStartPath: '/api/me/google-drive/oauth/start',
    statusPath: '/api/me/google-drive',
  },
]
