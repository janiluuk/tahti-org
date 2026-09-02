// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  createDiscoWidgetInstall,
  deleteDiscoWidgetInstall,
  fetchDiscoWidgetInstalls,
  fetchDiscoWidgetStore,
  patchDiscoWidgetInstall,
  type DiscoWidgetConfig,
} from '@/lib/disco-widgets-client'

const INSTALLS_PATH = '/api/me/channel/disco-widgets/installs'

export async function listChannelDiscoWidgetStore() {
  return fetchDiscoWidgetStore('ARTIST')
}

export async function listChannelDiscoWidgetInstalls() {
  return fetchDiscoWidgetInstalls(INSTALLS_PATH)
}

export async function installChannelDiscoWidget(widgetId: string) {
  return createDiscoWidgetInstall(INSTALLS_PATH, widgetId)
}

export async function patchChannelDiscoWidgetInstall(
  id: string,
  patch: { enabled?: boolean; position?: number; configJson?: DiscoWidgetConfig },
) {
  return patchDiscoWidgetInstall(INSTALLS_PATH, id, patch)
}

export async function removeChannelDiscoWidgetInstall(id: string) {
  return deleteDiscoWidgetInstall(INSTALLS_PATH, id)
}
