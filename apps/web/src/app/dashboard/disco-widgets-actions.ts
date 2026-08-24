// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  createDiscoWidgetInstall,
  deleteDiscoWidgetInstall,
  fetchDiscoWidgetInstalls,
  fetchDiscoWidgetStore,
  patchDiscoWidgetInstall,
} from '@/lib/disco-widgets-client'

const INSTALLS_PATH = '/api/me/disco-widgets/installs'

export async function listMyDiscoWidgetStore() {
  return fetchDiscoWidgetStore('LISTENER')
}

export async function listMyDiscoWidgetInstalls() {
  return fetchDiscoWidgetInstalls(INSTALLS_PATH)
}

export async function installMyDiscoWidget(widgetId: string) {
  return createDiscoWidgetInstall(INSTALLS_PATH, widgetId)
}

export async function patchMyDiscoWidgetInstall(
  id: string,
  patch: { enabled?: boolean; position?: number },
) {
  return patchDiscoWidgetInstall(INSTALLS_PATH, id, patch)
}

export async function removeMyDiscoWidgetInstall(id: string) {
  return deleteDiscoWidgetInstall(INSTALLS_PATH, id)
}
