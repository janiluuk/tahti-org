// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Per-provider install-time logic for the API_KEY integration marketplace
// (packages/shared/src/integration-providers.ts). Most providers just store
// whatever fields the user typed — no installer entry needed for those. A
// provider registers one here only when installing means *doing* something
// with the submitted fields before they're stored: exchanging credentials
// for a durable token, or rejecting the install outright with a specific
// reason. Keeps that provider-specific knowledge contained to this file
// rather than leaking into the generic install route.

import { loginToHearthis, HearthisLoginError } from '@tahti/hearthis'
import { validateListenBrainzToken } from './listenbrainz.js'

export type IntegrationInstaller = (
  fields: Record<string, string>,
) => Promise<{ fields: Record<string, string> } | { error: string }>

const INTEGRATION_INSTALLERS: Record<string, IntegrationInstaller> = {
  // Exchanges the email/password the user types for the durable key/secret
  // pair hearthis.at's own API expects (see @tahti/hearthis). Only the
  // key/secret are ever persisted — the password is used once, here, and
  // discarded. Also where "Premium required" actually gets enforced: reject
  // the install outright rather than only failing at export time.
  'hearthis-export': async (fields) => {
    const email = fields.email?.trim()
    const password = fields.password
    if (!email || !password) return { error: 'Missing field: email or password' }

    let result
    try {
      result = await loginToHearthis(email, password)
    } catch (err) {
      if (err instanceof HearthisLoginError) {
        return { error: 'Incorrect hearthis.at email or password.' }
      }
      throw err
    }

    if (!result.premium) {
      return {
        error:
          'hearthis.at Premium is required to export tracks. Upgrade at hearthis.at/premium/, then reinstall this plugin.',
      }
    }

    return { fields: { key: result.auth.key, secret: result.auth.secret } }
  },

  // Validates the ListenBrainz user token before storing it. Only the token
  // is persisted — never a password. Reject install when validate-token fails.
  listenbrainz: async (fields) => {
    const userToken = fields.userToken?.trim()
    if (!userToken) return { error: 'Missing field: userToken' }

    const result = await validateListenBrainzToken(userToken)
    if (!result.ok) return { error: result.error }

    return { fields: { userToken } }
  },
}

export function getIntegrationInstaller(slug: string): IntegrationInstaller | undefined {
  return INTEGRATION_INSTALLERS[slug]
}
