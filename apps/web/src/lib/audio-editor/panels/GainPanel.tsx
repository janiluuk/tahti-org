// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import type { GainParams } from '@tahti/audio-edit'
import type { MeasuredLoudness } from '@tahti/audio-edit'

export function GainPanel({
  params,
  onChange,
  measured,
  onMeasure,
  measuring,
}: {
  params: GainParams
  onChange(next: GainParams): void
  measured?: MeasuredLoudness
  onMeasure?(): void
  measuring?: boolean
}) {
  return (
    <div className="plug-panel">
      <div className="plug-panel__row">
        <div className="plug-panel__knob-group">
          <Knob
            value={params.db}
            min={-24}
            max={24}
            step={0.1}
            unit="dB"
            label="Gain"
            defaultValue={0}
            color="var(--amber)"
            onChange={(v) => onChange({ ...params, db: v })}
            formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
          />
          <span className="plug-panel__label">Gain</span>
        </div>
      </div>

      <div className="plug-panel__section">
        <div className="plug-panel__toggle-row">
          <span className="plug-panel__section-label">Normalize</span>
          <button
            type="button"
            role="switch"
            aria-checked={params.normalize.enabled}
            className="plug-panel__switch"
            onClick={() =>
              onChange({ ...params, normalize: { ...params.normalize, enabled: !params.normalize.enabled } })
            }
          >
            <span className="plug-panel__switch-thumb" />
          </button>
        </div>
        {params.normalize.enabled && (
          <div className="plug-panel__row">
            <div className="plug-panel__knob-group">
              <Knob
                value={params.normalize.targetLufs}
                min={-30}
                max={-5}
                step={0.5}
                unit=" LUFS"
                label="Target LUFS"
                defaultValue={-14}
                color="var(--cyan)"
                onChange={(v) =>
                  onChange({ ...params, normalize: { ...params.normalize, targetLufs: v } })
                }
                formatValue={(v) => v.toFixed(1)}
              />
              <span className="plug-panel__label">Target LUFS</span>
            </div>
            <div className="plug-panel__knob-group">
              <Knob
                value={params.normalize.targetTp}
                min={-6}
                max={0}
                step={0.5}
                unit=" dBTP"
                label="True Peak ceiling"
                defaultValue={-1.5}
                color="var(--cyan)"
                onChange={(v) =>
                  onChange({ ...params, normalize: { ...params.normalize, targetTp: v } })
                }
                formatValue={(v) => v.toFixed(1)}
              />
              <span className="plug-panel__label">True Peak</span>
            </div>
          </div>
        )}
        {params.normalize.enabled && (
          <div className="plug-panel__measure-row">
            <button
              type="button"
              className="plug-panel__measure-btn"
              onClick={onMeasure}
              disabled={measuring}
            >
              {measuring ? 'Measuring…' : 'Measure loudness'}
            </button>
            {measured && (
              <span className="plug-panel__measure-result">
                {measured.i.toFixed(1)} LUFS · {measured.tp.toFixed(1)} dBTP (measured)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
