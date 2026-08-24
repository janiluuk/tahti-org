// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Badge, Button } from '@tahti/ui'
import type { DiscoWidgetInstallView } from '@tahti/shared'

export interface DiscoWidgetInstalledListProps {
  installs: DiscoWidgetInstallView[]
  pendingId: string | null
  onToggle: (id: string, enabled: boolean) => void
  onMove: (id: string, direction: 'up' | 'down') => void
  onRemove: (id: string) => void
}

/** Nuclear's "Installed" tab: manage what's already installed — toggle on/off,
 * reorder, remove. Sorted list order (by `position`) is the render order on
 * whatever page these widgets actually show up on. */
export function DiscoWidgetInstalledList({
  installs,
  pendingId,
  onToggle,
  onMove,
  onRemove,
}: DiscoWidgetInstalledListProps) {
  if (installs.length === 0) {
    return <p className="studio-empty">Nothing installed yet — add one from the store above.</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {installs.map((install, index) => {
        const isPending = pendingId === install.id
        return (
          <div
            key={install.id}
            className="ui-panel studio-row studio-row--start"
            style={{ opacity: install.enabled ? 1 : 0.5 }}
          >
            <div className="studio-flex-1">
              <div className="studio-row studio-gap-xs">
                <strong>{install.widget.name}</strong>
                <Badge variant="neutral">v{install.widget.currentVersion}</Badge>
              </div>
              <p className="studio-text-muted-sm studio-mt-xs">{install.widget.description}</p>
            </div>
            <div className="studio-row studio-gap-xs" style={{ flexShrink: 0 }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending || index === 0}
                onClick={() => onMove(install.id, 'up')}
                aria-label="Move up"
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending || index === installs.length - 1}
                onClick={() => onMove(install.id, 'down')}
                aria-label="Move down"
              >
                ↓
              </Button>
              <label className="studio-toggle-row">
                <input
                  type="checkbox"
                  className="studio-toggle-checkbox"
                  checked={install.enabled}
                  disabled={isPending}
                  onChange={(e) => onToggle(install.id, e.target.checked)}
                />
                <span className="studio-toggle-label">Enabled</span>
              </label>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={() => onRemove(install.id)}
              >
                Remove
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
