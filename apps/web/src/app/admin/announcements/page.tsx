// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { fetchAnnouncementSettings, fetchSystemAnnouncements } from './actions'
import { AdminAnnouncementsPanel } from './_admin-announcements-panel'

export default async function AdminAnnouncementsPage() {
  const [{ clips }, { systemEnabled }] = await Promise.all([
    fetchSystemAnnouncements(),
    fetchAnnouncementSettings(),
  ])

  return (
    <>
      <h1 className="admin-section-title">Announcements</h1>
      <p className="admin-stat-sub" style={{ marginBottom: '1rem' }}>
        System-wide audio clips (station IDs, PSAs) interleaved into every channel&apos;s 24/7
        rotation. Artists can also upload their own from{' '}
        <code>Dashboard → Settings → Announcements</code>.
      </p>

      <AdminAnnouncementsPanel initialClips={clips} initialSystemEnabled={systemEnabled} />
    </>
  )
}
