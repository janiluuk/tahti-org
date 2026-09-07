// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, SortableList } from '@tahti/ui'
import type { DiscoWidgetInstallView } from '@tahti/shared'

function formatConfig(configJson: unknown): string {
  try {
    return JSON.stringify(configJson ?? {}, null, 2)
  } catch {
    return '{}'
  }
}

export interface DiscoWidgetInstalledListProps {
  installs: DiscoWidgetInstallView[]
  pendingId: string | null
  onToggle: (id: string, enabled: boolean) => void
  onReorder: (next: DiscoWidgetInstallView[]) => void
  onRemove: (id: string) => void
  onConfigure: (id: string, configJson: Record<string, unknown>) => void
  /** Board-only — when provided, an extra "Save as default" action appears
   * next to Configure, promoting this row's current config to be what every
   * new install of the widget starts from (any scope). Omit entirely for
   * listener/artist-facing surfaces. */
  onSaveAsDefault?: (id: string, configJson: Record<string, unknown>) => void
}

/** Tahti Player's "Installed" tab: manage what's already installed — toggle on/off,
 * drag to reorder, configure, remove. Sorted list order (by `position`) is the
 * render order on whatever page these widgets actually show up on. Configure
 * expands inline below the row (same pattern as Settings › Connections'
 * "Configure" action) rather than opening a modal, for one consistent
 * add/configure feel across the dashboard. */
export function DiscoWidgetInstalledList({
  installs,
  pendingId,
  onToggle,
  onReorder,
  onRemove,
  onConfigure,
  onSaveAsDefault,
}: DiscoWidgetInstalledListProps) {
  const [configuringId, setConfiguringId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  if (installs.length === 0) {
    return <p className="studio-empty">Nothing installed yet — add one from the store above.</p>
  }

  function openConfigure(install: DiscoWidgetInstallView) {
    setConfiguringId(install.id)
    setDraft(formatConfig(install.configJson))
    setDraftError(null)
  }

  function closeConfigure() {
    setConfiguringId(null)
    setDraftError(null)
  }

  function parseDraft(): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(draft || '{}')
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setDraftError('Must be a JSON object, e.g. {"key": "value"}')
        return null
      }
      return parsed as Record<string, unknown>
    } catch {
      setDraftError('Not valid JSON')
      return null
    }
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
        const isConfiguring = configuringId === install.id
        return (
          <div
            ref={sortable.ref}
            className={`ui-panel disco-widget-installed-row${
              sortable.isDragging ? ' is-dragging' : ''
            }`}
          >
            <div
              className="studio-row studio-row--start"
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
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  aria-expanded={isConfiguring}
                  onClick={() => (isConfiguring ? closeConfigure() : openConfigure(install))}
                >
                  {isConfiguring ? 'Close' : 'Configure'}
                </Button>
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
            {isConfiguring && (
              <div className="disco-widget-configure studio-mt-sm">
                <label className="studio-label" htmlFor={`widget-config-${install.id}`}>
                  Widget config (JSON)
                </label>
                <textarea
                  id={`widget-config-${install.id}`}
                  className="studio-input studio-textarea disco-widget-configure__textarea"
                  rows={8}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setDraftError(null)
                  }}
                  spellCheck={false}
                />
                {draftError && (
                  <p className="studio-notice studio-notice--error studio-mt-xs">{draftError}</p>
                )}
                <div className="studio-row studio-gap-xs studio-mt-sm">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      const parsed = parseDraft()
                      if (!parsed) return
                      onConfigure(install.id, parsed)
                      closeConfigure()
                    }}
                  >
                    Save config
                  </Button>
                  {onSaveAsDefault && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      title="Make this the starting config for every new install of this widget"
                      onClick={() => {
                        const parsed = parseDraft()
                        if (!parsed) return
                        onSaveAsDefault(install.id, parsed)
                      }}
                    >
                      ★ Save as default for everyone
                    </Button>
                  )}
                  <Button type="button" variant="ghost" size="sm" onClick={closeConfigure}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      }}
    />
  )
}
