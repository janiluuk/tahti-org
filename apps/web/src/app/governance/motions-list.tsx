// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import MotionCard, { type MotionSummary } from './motion-card'

type Filter = 'OPEN' | 'CLOSED' | 'AGM'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'AGM', label: 'AGM' },
]

/** "M-2026-03" — sequential per opening year, oldest first. */
function motionRefs(motions: MotionSummary[]): Map<string, string> {
  const counters: Record<string, number> = {}
  const sorted = [...motions].sort(
    (a, b) => new Date(a.openAt).getTime() - new Date(b.openAt).getTime(),
  )
  const refs = new Map<string, string>()
  for (const m of sorted) {
    const year = new Date(m.openAt).getFullYear()
    counters[year] = (counters[year] ?? 0) + 1
    refs.set(m.id, `M-${year}-${String(counters[year]).padStart(2, '0')}`)
  }
  return refs
}

export default function MotionsList({
  motions,
  totalMembers,
  isBoard,
}: {
  motions: MotionSummary[]
  totalMembers: number
  isBoard: boolean
}) {
  const [filter, setFilter] = useState<Filter>('OPEN')
  const refs = useMemo(() => motionRefs(motions), [motions])

  const filtered = motions.filter((m) => {
    if (filter === 'OPEN') return m.state === 'OPEN' || m.state === 'DRAFT'
    if (filter === 'CLOSED') return m.state === 'CLOSED'
    return !m.advisory
  })

  return (
    <div>
      <div className="gov-header-row">
        <div>
          <h2 className="brand-section__title brand-section-heading">Open motions</h2>
          <p className="gov-header-row__subline">
            One member, one vote · advisory until AGM ratifies · tally hidden until close
          </p>
        </div>
        <div className="filter-pills" role="group" aria-label="Filter motions">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter-pills__item${filter === f.value ? ' filter-pills__item--active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="public-empty-card">
          <p className="public-empty-card__text">No motions in this view.</p>
        </div>
      ) : (
        <div className="gov-motion-list">
          {filtered.map((m) => (
            <MotionCard
              key={m.id}
              motion={m}
              motionRef={refs.get(m.id) ?? m.id}
              totalMembers={totalMembers}
              isBoard={isBoard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
