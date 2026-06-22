// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { MentionsPanel } from '../../mentions-panel'

export default function MentionsSettingsPage() {
  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Mentions</h1>
      </div>

      <MentionsPanel />
    </div>
  )
}
