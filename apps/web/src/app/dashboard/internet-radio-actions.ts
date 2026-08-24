// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import {
  addMyInternetRadioStation,
  deleteMyInternetRadioStation,
  fetchInternetRadioPresets,
  fetchMyInternetRadioStations,
  patchMyInternetRadioStation,
} from '@/lib/internet-radio-client'

export async function listInternetRadioPresets() {
  return fetchInternetRadioPresets()
}

export async function listMyInternetRadioStations() {
  return fetchMyInternetRadioStations()
}

export async function addInternetRadioStationFromPreset(presetId: string) {
  return addMyInternetRadioStation({ presetId })
}

export async function addCustomInternetRadioStation(input: {
  name: string
  genre?: string
  description?: string
  streamUrl?: string
}) {
  return addMyInternetRadioStation(input)
}

export async function patchInternetRadioStation(
  id: string,
  patch: { streamUrl?: string; name?: string; position?: number },
) {
  return patchMyInternetRadioStation(id, patch)
}

export async function removeInternetRadioStation(id: string) {
  return deleteMyInternetRadioStation(id)
}
