// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { isRevelatorConfigured } from '@tahti/revelator'
import { config } from '../config.js'

export function buildDistributionIntegrationsStatus() {
  const mixcloudConfigured = Boolean(config.mixcloud.clientId && config.mixcloud.clientSecret)
  const revelatorConfigured = isRevelatorConfigured()

  return {
    integrations: [
      {
        id: 'mixcloud' as const,
        label: 'Mixcloud',
        configured: mixcloudConfigured,
        mode: mixcloudConfigured ? ('live' as const) : ('stub' as const),
        detail: mixcloudConfigured
          ? 'OAuth + archive upload enabled'
          : 'Set MIXCLOUD_CLIENT_ID and mixcloud_client_secret Swarm secret',
      },
      {
        id: 'revelator' as const,
        label: 'Revelator',
        configured: revelatorConfigured,
        mode: revelatorConfigured ? ('live' as const) : ('stub' as const),
        detail: revelatorConfigured
          ? 'DSP submit + royalty sync enabled'
          : 'Set revelator_api_key Swarm secret (REVELATOR_API_KEY_FILE)',
      },
    ],
  }
}
