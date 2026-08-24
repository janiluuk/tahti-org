// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Panel } from '@tahti/ui'
import type { DiscoWidgetInstallView, DiscoWidgetStoreItem } from '@tahti/shared'
import { DiscoWidgetManagerPanel } from '@/components/disco-widgets/disco-widget-manager-panel'
import {
  installChannelDiscoWidget,
  patchChannelDiscoWidgetInstall,
  removeChannelDiscoWidgetInstall,
} from './channel-disco-widgets-actions'

export interface ChannelDiscoWidgetsPanelProps {
  initialWidgets: DiscoWidgetStoreItem[]
  initialInstalls: DiscoWidgetInstallView[]
}

/** Self-contained, like PressKitBuilder next to it: acts immediately (install/
 * toggle/remove take effect right away), not gated behind the channel
 * editor's "Publish changes" button — same reasoning as press kit's images. */
export function ChannelDiscoWidgetsPanel({
  initialWidgets,
  initialInstalls,
}: ChannelDiscoWidgetsPanelProps) {
  return (
    <Panel
      title="Disco-widgets"
      description="Add widgets to your public channel page — visitors see whatever you enable here."
    >
      <DiscoWidgetManagerPanel
        initialWidgets={initialWidgets}
        initialInstalls={initialInstalls}
        actions={{
          install: installChannelDiscoWidget,
          patch: patchChannelDiscoWidgetInstall,
          remove: removeChannelDiscoWidgetInstall,
        }}
      />
    </Panel>
  )
}
