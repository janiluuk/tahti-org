// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Panel } from '@tahti/ui'
import type { AddonInstallView, AddonStoreItem } from '@tahti/shared'
import { AddonManagerPanel } from '@/components/addons/addon-manager-panel'
import {
  installChannelAddon,
  patchChannelAddonInstall,
  removeChannelAddonInstall,
} from './channel-addons-actions'

export interface ChannelAddonsPanelProps {
  initialWidgets: AddonStoreItem[]
  initialInstalls: AddonInstallView[]
  /** Render without the outer Panel/title — used when embedded in the designer's own section chrome. */
  bare?: boolean
}

/** Self-contained, like PressKitBuilder next to it: acts immediately (install/
 * toggle/remove take effect right away), not gated behind a Save button —
 * same reasoning as press kit's images. */
export function ChannelAddonsPanel({
  initialWidgets,
  initialInstalls,
  bare = false,
}: ChannelAddonsPanelProps) {
  const manager = (
    <AddonManagerPanel
      initialWidgets={initialWidgets}
      initialInstalls={initialInstalls}
      actions={{
        install: installChannelAddon,
        patch: patchChannelAddonInstall,
        remove: removeChannelAddonInstall,
      }}
    />
  )

  if (bare) return manager

  return (
    <Panel
      title="Addons"
      description="Add widgets to your public channel page — visitors see whatever you enable here."
    >
      {manager}
    </Panel>
  )
}
