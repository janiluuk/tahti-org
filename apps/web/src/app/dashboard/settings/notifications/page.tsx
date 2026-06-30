// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { NotificationPreferencesPanel } from '../notification-preferences-panel'

export default function NotificationSettingsPage() {
  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Notifications</h1>
      </div>

      <NotificationPreferencesPanel />
    </div>
  )
}
