// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { Badge, Button, SortableList } from '@tahti/ui'
import type { DiscoWidgetInstallView } from '@tahti/shared'

export interface DiscoWidgetInstalledListProps {
  installs: DiscoWidgetInstallView[]
  pendingId: string | null
  onToggle: (id: string, enabled: boolean) => void
  onReorder: (next: DiscoWidgetInstallView[]) => void
  onRemove: (id: string) => void
}

/** Nuclear's "Installed" tab: manage what's already installed — toggle on/off,
 * drag to reorder, remove. Sorted list order (by `position`) is the render
 * order on whatever page these widgets actually show up on. */
export function DiscoWidgetInstalledList({
  installs,
  pendingId,
  onToggle,
  onReorder,
  onRemove,
}: DiscoWidgetInstalledListProps) {
  if (installs.length === 0) {
    return <p className="studio-empty">Nothing installed yet — add one from the store above.</p>
  }

  return (
    <SortableList
      as="div"
      className="disco-widget-installed-list"
      items={installs}
      itemId={(install) => install.id}
      onReorder={onReorder}
      renderItem={(install, _index, sortable) => {
        const isPending = pendingId === install.id || pendingId === 'reorder'
        return (
          <div
            ref={sortable.ref}
            className={`ui-panel studio-row studio-row--start disco-widget-installed-row${
              sortable.isDragging ? ' is-dragging' : ''
            }`}
            style={{ opacity: install.enabled ? 1 : 0.5 }}
          >
            <button
              ref={sortable.handleRef}
              type="button"
              className="disco-widget-installed-row__handle"
              aria-label={`Reorder ${install.widget.name}`}
              disabled={isPending}
            >
              ⠿
            </button>
            <div className="studio-flex-1">
              <div className="studio-row studio-gap-xs">
                <strong>{install.widget.name}</strong>
                <Badge variant="neutral">v{install.widget.currentVersion}</Badge>
              </div>
              <p className="studio-text-muted-sm studio-mt-xs">{install.widget.description}</p>
            </div>
            <div className="studio-row studio-gap-xs" style={{ flexShrink: 0 }}>
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
      }}
    />
  )
}
