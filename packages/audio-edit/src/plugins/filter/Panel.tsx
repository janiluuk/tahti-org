// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import { FILTER_MODES, FILTER_SLOPES } from '../../types.js'
import type { FilterMode, FilterSlope } from '../../types.js'
import type { FilterParams } from './index.js'

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
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
      </div>

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
