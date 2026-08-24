// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Panel } from '@tahti/ui'
import type { DiscoWidgetInstallView, DiscoWidgetStoreItem } from '@tahti/shared'
import { DiscoWidgetManagerPanel } from '@/components/disco-widgets/disco-widget-manager-panel'
import {
  installMyDiscoWidget,
  patchMyDiscoWidgetInstall,
  removeMyDiscoWidgetInstall,
} from './disco-widgets-actions'

export interface DiscoWidgetsPanelProps {
  initialWidgets: DiscoWidgetStoreItem[]
  initialInstalls: DiscoWidgetInstallView[]
}

export function DiscoWidgetsPanel({ initialWidgets, initialInstalls }: DiscoWidgetsPanelProps) {
  return (
    <Panel
      title="Disco-widgets"
      description="Add widgets to your own Discover page — only you see what you enable here."
    >
      <DiscoWidgetManagerPanel
        initialWidgets={initialWidgets}
        initialInstalls={initialInstalls}
        actions={{
          install: installMyDiscoWidget,
          patch: patchMyDiscoWidgetInstall,
          remove: removeMyDiscoWidgetInstall,
        }}
      />
    </Panel>
  )
}
