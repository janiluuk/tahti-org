// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchAddonCatalog, listHomepageAddonInstalls } from './actions'
import { AdminAddonsPanel } from './_admin-addons-panel'

export default async function AdminAddonsPage() {
  const [catalog, homepageApproved, homepageInstalls] = await Promise.all([
    fetchAddonCatalog(),
    fetchAddonCatalog('ADMIN', 'APPROVED'),
    listHomepageAddonInstalls(),
  ])

  return (
    <>
      <h1 className="admin-section-title">Addons</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        Register, publish, and moderate widgets across all three stores (listener, artist, admin),
        and manage which ADMIN-scope widgets appear on the homepage.
      </p>

      <AdminAddonsPanel
        initialCatalog={catalog.widgets}
        initialHomepageStore={homepageApproved.widgets}
        initialHomepageInstalls={homepageInstalls.installs}
      />
    </>
  )
}
