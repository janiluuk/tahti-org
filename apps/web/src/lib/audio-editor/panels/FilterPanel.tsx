// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import { FILTER_MODES, FILTER_SLOPES } from '@tahti/audio-edit'
import type { FilterMode, FilterParams, FilterSlope } from '@tahti/audio-edit'

const MODE_LABELS: Record<FilterMode, string> = {
  highpass: 'High pass',
  highshelf: 'High shelf',
  lowpass: 'Low pass',
  lowshelf: 'Low shelf',
}

const SLOPE_LABELS: Record<FilterSlope, string> = {
  '12db': '12 dB',
  '24db': '24 dB',
  brickwall: 'Brickwall',
}

function FilterModeIcon({ mode }: { mode: FilterMode }) {
  const passAbove = mode === 'highpass' || mode === 'lowshelf'
  const shelf = mode === 'highshelf' || mode === 'lowshelf'
  const path = passAbove
    ? shelf
      ? 'M2 12 H7 Q9 12 10 8 T14 4 H22'
      : 'M2 14 Q8 14 10 8 T22 3'
    : shelf
      ? 'M2 4 H10 Q12 4 13 8 T18 12 H22'
      : 'M2 3 Q14 3 16 9 T22 14'
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FilterCurve({ params }: { params: FilterParams }) {
  const cutoff = Math.max(8, Math.min(92, ((Math.log10(params.freq) - Math.log10(20)) / 3) * 100))
  const width = params.slope === '12db' ? 16 : params.slope === '24db' ? 10 : 5
  const passAbove = params.mode === 'highpass' || params.mode === 'lowshelf'
  const left = Math.max(0, cutoff - width)
  const right = Math.min(100, cutoff + width)
  const path = passAbove
    ? `M 0 88 L ${left} 88 C ${cutoff} 88 ${cutoff} 12 ${right} 12 L 100 12`
    : `M 0 12 L ${left} 12 C ${cutoff} 12 ${cutoff} 88 ${right} 88 L 100 88`

  return (
    <div className="plug-filter-curve" aria-label={`Filter response at ${params.freq} Hz`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <path className="plug-filter-curve__grid" d="M0 25H100 M0 50H100 M0 75H100 M25 0V100 M50 0V100 M75 0V100" />
        <path className="plug-filter-curve__area" d={`${path} L 100 100 L 0 100 Z`} />
        <path className="plug-filter-curve__line" d={path} />
        <line className="plug-filter-curve__cutoff" x1={cutoff} x2={cutoff} y1="0" y2="100" />
      </svg>
      <span>{params.freq >= 1000 ? `${(params.freq / 1000).toFixed(1)} kHz` : `${params.freq} Hz`}</span>
    </div>
  )
}

export function FilterPanel({
  params,
  onChange,
}: {
  params: FilterParams
  onChange(next: FilterParams): void
}) {
  return (
    <div className="plug-panel">
      <div className="plug-panel__section">
        <span className="plug-panel__section-label">Mode</span>
        <div className="plug-panel__segment-group" role="group" aria-label="Filter mode">
          {FILTER_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={`plug-panel__segment${params.mode === mode ? ' plug-panel__segment--active' : ''}`}
              onClick={() => onChange({ ...params, mode })}
            >
              <FilterModeIcon mode={mode} />
              <span>{MODE_LABELS[mode]}</span>
            </button>
          ))}
        </div>
      </div>

      <FilterCurve params={params} />

      <div className="plug-panel__section">
        <span className="plug-panel__section-label">Cutoff curve</span>
        <div className="plug-panel__segment-group" role="group" aria-label="Filter slope">
          {FILTER_SLOPES.map((slope) => (
            <button
              key={slope}
              type="button"
              className={`plug-panel__segment${params.slope === slope ? ' plug-panel__segment--active' : ''}`}
              onClick={() => onChange({ ...params, slope })}
            >
              {SLOPE_LABELS[slope]}
            </button>
          ))}
        </div>
      </div>

      <div className="plug-panel__row">
        <div className="plug-panel__knob-group">
          <Knob
            value={params.freq}
            min={20}
            max={20000}
            step={1}
            unit=" Hz"
            label="Frequency"
            defaultValue={80}
            color="var(--cyan)"
            onChange={(v) => onChange({ ...params, freq: Math.round(v) })}
            formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)}
          />
          <span className="plug-panel__label">
            {params.freq >= 1000 ? `${(params.freq / 1000).toFixed(1)} kHz` : `${params.freq} Hz`}
          </span>
        </div>
      </div>
    </div>
  )
}
