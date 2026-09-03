// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  createAddonInstall,
  deleteAddonInstall,
  fetchAddonInstalls,
  fetchAddonStore,
  patchAddonInstall,
  type AddonConfig,
} from '@/lib/addons-client'

const INSTALLS_PATH = '/api/me/addons/installs'

export async function listMyAddonStore() {
  return fetchAddonStore('LISTENER')
}

export async function listMyAddonInstalls() {
  return fetchAddonInstalls(INSTALLS_PATH)
}

export async function installMyAddon(widgetId: string) {
  return createAddonInstall(INSTALLS_PATH, widgetId)
}

export async function patchMyAddonInstall(
  id: string,
  patch: { enabled?: boolean; position?: number; configJson?: AddonConfig },
) {
  return patchAddonInstall(INSTALLS_PATH, id, patch)
}

export async function removeMyAddonInstall(id: string) {
  return deleteAddonInstall(INSTALLS_PATH, id)
}
