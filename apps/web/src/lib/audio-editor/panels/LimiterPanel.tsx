// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import type { LimiterParams } from '@tahti/audio-edit'

export function LimiterPanel({
  params,
  onChange,
}: {
  params: LimiterParams
  onChange(next: LimiterParams): void
}) {
  return (
    <div className="plug-panel">
      <div className="plug-panel__row">
        <div className="plug-panel__knob-group">
          <Knob
            value={params.ceilingDb}
            min={-3}
            max={0}
            step={0.1}
            unit=" dBTP"
            label="Ceiling"
            defaultValue={-1.0}
            color="var(--red)"
            onChange={(v) => onChange({ ...params, ceilingDb: v })}
            formatValue={(v) => `${v.toFixed(1)}`}
          />
          <span className="plug-panel__label">Ceiling</span>
        </div>
        <div className="plug-panel__knob-group">
          <Knob
            value={params.releaseMs}
            min={1}
            max={1000}
            step={1}
            unit=" ms"
            label="Release"
            defaultValue={50}
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
