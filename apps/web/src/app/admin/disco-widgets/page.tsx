// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchDiscoWidgetCatalog, listHomepageDiscoWidgetInstalls } from './actions'
import { AdminDiscoWidgetsPanel } from './_admin-disco-widgets-panel'

export default async function AdminDiscoWidgetsPage() {
  const [catalog, homepageApproved, homepageInstalls] = await Promise.all([
    fetchDiscoWidgetCatalog(),
    fetchDiscoWidgetCatalog('ADMIN', 'APPROVED'),
    listHomepageDiscoWidgetInstalls(),
  ])

  return (
    <>
      <h1 className="admin-section-title">Disco-widgets</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        Register, publish, and moderate widgets across all three stores (listener, artist,
        admin), and manage which ADMIN-scope widgets appear on the homepage.
      </p>

      <AdminDiscoWidgetsPanel
        initialCatalog={catalog.widgets}
        initialHomepageStore={homepageApproved.widgets}
        initialHomepageInstalls={homepageInstalls.installs}
      />
    </>
  )
}
