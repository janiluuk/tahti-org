// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import type { CompParams } from './index.js'

export function CompPanel({
  params,
  onChange,
}: {
  params: CompParams
  onChange(next: CompParams): void
}) {
  return (
    <div className="plug-panel">
      <div className="plug-panel__row">
        <div className="plug-panel__knob-group">
          <Knob
            value={params.thresholdDb}
            min={-60}
            max={0}
            step={0.5}
            unit=" dB"
            label="Threshold"
            defaultValue={-18}
            color="var(--amber)"
            onChange={(v) => onChange({ ...params, thresholdDb: v })}
            formatValue={(v) => `${v.toFixed(1)}`}
          />
          <span className="plug-panel__label">Threshold</span>
        </div>
        <div className="plug-panel__knob-group">
          <Knob
            value={params.ratio}
            min={1}
            max={20}
            step={0.1}
            label="Ratio"
            defaultValue={3}
            color="var(--orange)"
            onChange={(v) => onChange({ ...params, ratio: v })}
            formatValue={(v) => `${v.toFixed(1)}:1`}
          />
          <span className="plug-panel__label">Ratio</span>
        </div>
        <div className="plug-panel__knob-group">
          <Knob
            value={params.makeupDb}
            min={0}
            max={24}
            step={0.5}
            unit=" dB"
            label="Makeup gain"
            defaultValue={0}
            color="var(--green)"
            onChange={(v) => onChange({ ...params, makeupDb: v })}
            formatValue={(v) => `+${v.toFixed(1)}`}
          />
          <span className="plug-panel__label">Makeup</span>
        </div>
      </div>
      <div className="plug-panel__row">
        <div className="plug-panel__knob-group">
          <Knob
            value={params.attackMs}
            min={0.1}
            max={500}
            step={0.1}
            unit=" ms"
            label="Attack"
            defaultValue={25}
            color="var(--muted)"
            onChange={(v) => onChange({ ...params, attackMs: v })}
            formatValue={(v) => `${v.toFixed(1)}`}
          />
          <span className="plug-panel__label">Attack</span>
        </div>
        <div className="plug-panel__knob-group">
          <Knob
            value={params.releaseMs}
            min={1}
            max={5000}
            step={1}
            unit=" ms"
            label="Release"
            defaultValue={250}
            color="var(--muted)"
            onChange={(v) => onChange({ ...params, releaseMs: v })}
            formatValue={(v) => `${Math.round(v)}`}
          />
          <span className="plug-panel__label">Release</span>
        </div>
      </div>
    </div>
  )
}
