// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import type { DiscoWidgetInstallView, DiscoWidgetStoreItem } from '@tahti/shared'
import { DiscoWidgetStore } from './disco-widget-store'
import { DiscoWidgetInstalledList } from './disco-widget-installed-list'

export interface DiscoWidgetManagerActions {
  install: (widgetId: string) => Promise<{ error: string | null; install?: DiscoWidgetInstallView }>
  patch: (
    id: string,
    patch: { enabled?: boolean; position?: number },
  ) => Promise<{ error: string | null; install?: DiscoWidgetInstallView }>
  remove: (id: string) => Promise<{ error: string | null }>
}

export interface DiscoWidgetManagerPanelProps {
  initialWidgets: DiscoWidgetStoreItem[]
  initialInstalls: DiscoWidgetInstallView[]
  actions: DiscoWidgetManagerActions
}

/** The install-management half shared by every scope's settings surface —
 * browse + install, and manage what's already installed (toggle/reorder/
 * remove). Each scope's page supplies its own scope-bound server actions. */
export function DiscoWidgetManagerPanel({
  initialWidgets,
  initialInstalls,
  actions,
}: DiscoWidgetManagerPanelProps) {
  const [installs, setInstalls] = useState(initialInstalls)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const installedWidgetIds = useMemo(() => new Set(installs.map((i) => i.widget.id)), [installs])

  async function handleInstall(widgetId: string) {
    setError(null)
    setInstallingId(widgetId)
    const result = await actions.install(widgetId)
    setInstallingId(null)
    if (result.error || !result.install) {
      setError(result.error ?? 'Failed to install')
      return
    }
    setInstalls((prev) => [...prev, result.install!])
  }

  async function handleToggle(id: string, enabled: boolean) {
    setError(null)
    setPendingId(id)
    const result = await actions.patch(id, { enabled })
    setPendingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setInstalls((prev) => prev.map((i) => (i.id === id ? { ...i, enabled } : i)))
  }

  async function handleMove(id: string, direction: 'up' | 'down') {
    const index = installs.findIndex((i) => i.id === id)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || swapWith < 0 || swapWith >= installs.length) return

    const a = installs[index]!
    const b = installs[swapWith]!
    setError(null)
    setPendingId(id)
    const [resA, resB] = await Promise.all([
      actions.patch(a.id, { position: b.position }),
      actions.patch(b.id, { position: a.position }),
    ])
    setPendingId(null)
    if (resA.error || resB.error) {
      setError(resA.error ?? resB.error ?? 'Failed to reorder')
      return
    }
    setInstalls((prev) => {
      const next = [...prev]
      next[index] = { ...a, position: b.position }
      next[swapWith] = { ...b, position: a.position }
      return next.sort((x, y) => x.position - y.position)
    })
  }

  async function handleRemove(id: string) {
    setError(null)
    setPendingId(id)
    const result = await actions.remove(id)
    setPendingId(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setInstalls((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div>
      <DiscoWidgetInstalledList
        installs={installs}
        pendingId={pendingId}
        onToggle={(id, enabled) => void handleToggle(id, enabled)}
        onMove={(id, direction) => void handleMove(id, direction)}
        onRemove={(id) => void handleRemove(id)}
      />
      <h3 className="studio-mt-lg">Browse the store</h3>
      <DiscoWidgetStore
        widgets={initialWidgets}
        installedWidgetIds={installedWidgetIds}
        installingId={installingId}
        onInstall={(widgetId) => void handleInstall(widgetId)}
      />
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}
