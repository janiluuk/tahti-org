// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchAdminInternetRadioPresets } from './actions'
import { AdminInternetRadioPanel } from './_admin-internet-radio-panel'

export default async function AdminInternetRadioPage() {
  const { presets } = await fetchAdminInternetRadioPresets()

  return (
    <>
      <h1 className="admin-section-title">Internet radio sources</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        The preset stations users can one-click add to their own internet radio library. Playback
        happens client-side, straight from each station&apos;s own stream — Tahti never relays it.
      </p>
      <AdminInternetRadioPanel initialPresets={presets} />
    </>
  )
}
