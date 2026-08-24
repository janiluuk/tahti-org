// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchAdminThemes } from './actions'
import { AdminThemesPanel } from './_admin-themes-panel'

export default async function AdminThemesPage() {
  const allThemes = await fetchAdminThemes()
  const pending = allThemes.themes.filter((t) => t.visibility === 'PENDING_REVIEW')
  const decided = allThemes.themes.filter((t) => t.visibility !== 'PENDING_REVIEW')

  return (
    <>
      <h1 className="admin-section-title">Themes</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        Review theme submissions. Approving opens a pull request against tahti-org — merging it is
        what actually publishes the theme to the public gallery.
      </p>
      <AdminThemesPanel initialPending={pending} initialDecided={decided} />
    </>
  )
}
