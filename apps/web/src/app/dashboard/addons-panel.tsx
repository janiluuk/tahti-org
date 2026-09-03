// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Panel } from '@tahti/ui'
import type { AddonInstallView, AddonStoreItem } from '@tahti/shared'
import { AddonManagerPanel } from '@/components/addons/addon-manager-panel'
import { installMyAddon, patchMyAddonInstall, removeMyAddonInstall } from './addons-actions'

export interface AddonsPanelProps {
  initialWidgets: AddonStoreItem[]
  initialInstalls: AddonInstallView[]
}

export function AddonsPanel({ initialWidgets, initialInstalls }: AddonsPanelProps) {
  return (
    <Panel
      title="Addons"
      description="Add widgets to your own Discover page — only you see what you enable here."
    >
      <AddonManagerPanel
        initialWidgets={initialWidgets}
        initialInstalls={initialInstalls}
        actions={{
          install: installMyAddon,
          patch: patchMyAddonInstall,
          remove: removeMyAddonInstall,
        }}
      />
    </Panel>
  )
}
