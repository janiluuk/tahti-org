// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import React from 'react'
import { Knob } from '@tahti/ui'
import type { EqBand, EqParams } from '@tahti/audio-edit'

const BAND_COLORS = ['var(--amber)', 'var(--green)', 'var(--purple)'] as const
const BAND_NAMES = ['LOW', 'MID', 'HIGH'] as const
const WIDTH = 600
const HEIGHT = 100
const MIN_FREQ = 20
const MAX_FREQ = 20000
const MAX_GAIN_DB = 12

function freqToX(f: number) {
  return (Math.log(f / MIN_FREQ) / Math.log(MAX_FREQ / MIN_FREQ)) * WIDTH
}
function gainToY(db: number) {
  return HEIGHT / 2 - (db / MAX_GAIN_DB) * (HEIGHT / 2)
}
function responseAt(freq: number, bands: EqBand[]): number {
  let total = 0
  for (const b of bands) {
    if (b.type === 'highpass' || b.type === 'lowpass') continue
    const oct = Math.log2(freq / b.freq)
    const bw = 1 / Math.max(0.1, b.q)
    total += b.gainDb / (1 + (oct / bw) ** 2)
  }
  return Math.max(-MAX_GAIN_DB, Math.min(MAX_GAIN_DB, total))
}

function EqCurveV2({ bands }: { bands: EqBand[] }) {
  let curve = ''
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * WIDTH
    const freq = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / 80)
    const y = gainToY(responseAt(freq, bands))
    curve += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="plug-eq-curve"
      aria-label="EQ response curve"
    >
      {[MAX_GAIN_DB, 6, 0, -6, -MAX_GAIN_DB].map((db) => (
        <line
          key={db}
          x1={0}
          x2={WIDTH}
          y1={gainToY(db)}
          y2={gainToY(db)}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={db === 0 ? 1.5 : 1}
        />
      ))}
      {[80, 1200, 9000].map((f) => (
        <line
          key={f}
          x1={freqToX(f)}
          x2={freqToX(f)}
          y1={0}
          y2={HEIGHT}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
          strokeDasharray="2,3"
        />
      ))}
      <defs>
        <linearGradient id="eq-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.15} />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={`${curve} L ${WIDTH} ${HEIGHT / 2} L 0 ${HEIGHT / 2} Z`} fill="url(#eq-fill)" />
      <path d={curve} fill="none" stroke="var(--cyan)" strokeWidth={2} />
      {bands.map((b, i) => (
        <circle
          key={i}
          cx={freqToX(b.freq)}
          cy={gainToY(b.gainDb)}
          r={7}
          fill={BAND_COLORS[i % BAND_COLORS.length]}
          stroke="var(--bg)"
          strokeWidth={2}
        />
      ))}
    </svg>
  )
}

export function EqPanel({
  params,
  onChange,
}: {
  params: EqParams
  onChange(next: EqParams): void
}) {
  function updateBand(i: number, patch: Partial<EqBand>) {
    const bands = params.bands.map((b, j) => (j === i ? { ...b, ...patch } : b))
    onChange({ ...params, bands })
  }

  return (
    <div className="plug-panel">
      <EqCurveV2 bands={params.bands} />
      <div className="plug-eq-bands">
        {params.bands.map((band, i) => (
          <div
            key={i}
            className="plug-eq-band"
            style={{ '--band-color': BAND_COLORS[i % BAND_COLORS.length] } as React.CSSProperties}
          >
            <div className="plug-eq-band__header">
              <span
                className="plug-eq-band__name"
                style={{ color: BAND_COLORS[i % BAND_COLORS.length] }}
              >
                {BAND_NAMES[i % BAND_NAMES.length]} ·{' '}
                {band.type.toUpperCase().replace('HIGHSHELF', 'SHELF').replace('LOWSHELF', 'SHELF')}
              </span>
            </div>
            <div className="plug-eq-band__knobs">
              <div className="plug-panel__knob-group">
                <Knob
                  value={band.gainDb}
                  min={-12}
                  max={12}
                  step={0.5}
                  unit=" dB"
                  label={`Band ${i + 1} gain`}
                  defaultValue={0}
                  color={BAND_COLORS[i % BAND_COLORS.length]}
                  onChange={(v) => updateBand(i, { gainDb: v })}
                  formatValue={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
                />
                <span
                  className="plug-panel__label"
                  style={{ color: BAND_COLORS[i % BAND_COLORS.length] }}
                >
                  {band.gainDb >= 0 ? '+' : ''}
                  {band.gainDb.toFixed(1)} dB
                </span>
              </div>
              <div className="plug-panel__knob-group">
                <Knob
                  value={band.freq}
                  min={20}
                  max={20000}
                  step={1}
                  unit=" Hz"
                  label={`Band ${i + 1} frequency`}
                  defaultValue={band.freq}
                  color="var(--muted)"
                  onChange={(v) => updateBand(i, { freq: Math.round(v) })}
                  formatValue={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`
                  }
                />
                <span className="plug-panel__label">
                  {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)} kHz` : `${band.freq} Hz`}
                </span>
              </div>
              <div className="plug-panel__knob-group">
                <Knob
                  value={band.q}
                  min={0.1}
                  max={10}
                  step={0.1}
                  label={`Band ${i + 1} Q`}
                  defaultValue={1}
                  color="var(--muted)"
                  onChange={(v) => updateBand(i, { q: v })}
                  formatValue={(v) => v.toFixed(1)}
                />
                <span className="plug-panel__label">Q {band.q.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
