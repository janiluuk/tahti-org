// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import { Badge, Button, Input, Link } from '@tahti/ui'
import type { DiscoWidgetStoreItem } from '@tahti/shared'

const CATEGORY_ALL = 'all'

export interface DiscoWidgetStoreProps {
  widgets: DiscoWidgetStoreItem[]
  installedWidgetIds: Set<string>
  installingId: string | null
  onInstall: (widgetId: string) => void
}

/** The Nuclear-store layout: search + single-select category chips + a
 * vertical list of cards, each with a 3-state install button. Reused as-is
 * across the listener, artist, and admin stores — only the fetched `widgets`
 * differ per scope. */
export function DiscoWidgetStore({
  widgets,
  installedWidgetIds,
  installingId,
  onInstall,
}: DiscoWidgetStoreProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(CATEGORY_ALL)

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const w of widgets) for (const c of w.categories) seen.add(c)
    return [CATEGORY_ALL, ...Array.from(seen).sort()]
  }, [widgets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return widgets.filter((w) => {
      const matchesCategory = category === CATEGORY_ALL || w.categories.includes(category)
      if (!matchesCategory) return false
      if (!q) return true
      return (
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.authorName.toLowerCase().includes(q)
      )
    })
  }, [widgets, search, category])

  return (
    <div>
      <Input
        placeholder="Search widgets…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search Disco-widgets"
      />
      <div className="studio-row studio-row--wrap studio-gap-xs studio-mt-sm">
        {categories.map((c) => (
          <Button
            key={c}
            type="button"
            variant={c === category ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setCategory(c)}
          >
            {c === CATEGORY_ALL ? 'All' : c}
          </Button>
        ))}
      </div>

      <p className="studio-text-muted-sm studio-mt-sm">
        Don&apos;t see what you need? Anyone can build a widget —{' '}
        <Link href="/help/disco-widgets">learn how to submit your own</Link>.
      </p>

      {filtered.length === 0 ? (
        <p className="studio-empty studio-mt-sm">
          {widgets.length === 0
            ? 'No widgets available in this store yet.'
            : 'No widgets match your search.'}
        </p>
      ) : (
        <div
          className="studio-mt-sm"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {filtered.map((widget) => {
            const isInstalled = installedWidgetIds.has(widget.id)
            const isInstalling = installingId === widget.id
            return (
              <div key={widget.id} className="ui-panel studio-row studio-row--start">
                <div className="studio-flex-1">
                  <div className="studio-row studio-row--wrap studio-gap-xs">
                    <strong>{widget.name}</strong>
                    <span className="studio-text-muted-sm">by {widget.authorName}</span>
                    <Badge variant="neutral">v{widget.currentVersion}</Badge>
                    {widget.categories.map((c) => (
                      <Badge key={c} variant="neutral">
                        {c}
                      </Badge>
                    ))}
                  </div>
                  <p className="studio-text-muted-sm studio-mt-xs">{widget.description}</p>
                </div>
                <Button
                  type="button"
                  variant={isInstalled ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={isInstalled || isInstalling}
                  onClick={() => onInstall(widget.id)}
                  style={{ minWidth: '7rem', flexShrink: 0 }}
                >
                  {isInstalled ? 'Installed' : isInstalling ? 'Installing…' : 'Install'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
