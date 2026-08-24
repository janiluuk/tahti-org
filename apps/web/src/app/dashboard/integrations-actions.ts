// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  fetchMyIntegrations,
  installMyIntegration,
  removeMyIntegration,
} from '@/lib/integrations-client'

export async function listMyIntegrations() {
  return fetchMyIntegrations()
}

export async function installIntegration(slug: string, fields: Record<string, string>) {
  return installMyIntegration(slug, fields)
}

export async function removeIntegration(slug: string) {
  return removeMyIntegration(slug)
}
