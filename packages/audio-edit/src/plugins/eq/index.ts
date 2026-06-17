// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { CompileCtx, FilterStep } from '../../types.js'

export const EqBandSchema = z.object({
  freq: z.number().finite().min(20).max(20000),
  q: z.number().finite().min(0.1).max(10),
  gainDb: z.number().finite().min(-24).max(24),
  type: z.enum(['bell', 'highshelf', 'lowshelf', 'highpass', 'lowpass']),
})

export const EqParamsSchema = z.object({
  bands: z.array(EqBandSchema).max(3),
})

export type EqBand = z.infer<typeof EqBandSchema>
export type EqParams = z.infer<typeof EqParamsSchema>

export const DEFAULT_EQ_PARAMS: EqParams = {
  bands: [
    { freq: 80, q: 1.0, gainDb: 0, type: 'bell' },
    { freq: 1200, q: 1.0, gainDb: 0, type: 'bell' },
    { freq: 9000, q: 0.7, gainDb: 0, type: 'highshelf' },
  ],
}

/** A band with 0 dB gain and default Q adds nothing — omit it from the graph. */
function bandIsNoop(band: EqBand): boolean {
  if (Math.abs(band.gainDb) < 0.001) return true
  return false
}

function bandToFilter(band: EqBand): string {
  switch (band.type) {
    case 'bell':
      return `equalizer=f=${band.freq}:t=q:w=${band.q}:g=${band.gainDb}`
    case 'highshelf':
      return `equalizer=f=${band.freq}:t=h:w=${band.q}:g=${band.gainDb}`
    case 'lowshelf':
      return `equalizer=f=${band.freq}:t=l:w=${band.q}:g=${band.gainDb}`
    case 'highpass':
      return `highpass=f=${band.freq}:poles=2`
    case 'lowpass':
      return `lowpass=f=${band.freq}:poles=2`
  }
}

export function compileEq(params: EqParams, ctx: CompileCtx): FilterStep | null {
  const active = params.bands.filter((b) => !bandIsNoop(b))
  if (active.length === 0) return null
  const outLabel = ctx.outputLabel.replace(/[\[\]]/g, '')
  const graph = `${ctx.inputLabel}${active.map(bandToFilter).join(',')}[${outLabel}]`
  return { graph, inLabel: ctx.inputLabel, outLabel: ctx.outputLabel }
}

export function eqChainSummary(params: EqParams, enabled: boolean): string {
  if (!enabled) return 'bypassed'
  const labels = params.bands.map((b) => {
    const sign = b.gainDb >= 0 ? '+' : ''
    return `${sign}${b.gainDb.toFixed(1)}`
  })
  return labels.join(' · ')
}

export function createEqPreviewNode(
  audioCtx: AudioContext,
  params: EqParams,
): { input: AudioNode; output: AudioNode; update(p: EqParams): void; dispose(): void } {
  const input = audioCtx.createGain()
  const output = audioCtx.createGain()
  const filters: BiquadFilterNode[] = params.bands.map((band) => {
    const f = audioCtx.createBiquadFilter()
    applyBandToFilter(f, band)
    return f
  })

  // Chain: input → filter[0] → filter[1] → filter[2] → output
  let prev: AudioNode = input
  for (const f of filters) {
    prev.connect(f)
    prev = f
  }
  prev.connect(output)

  function applyBandToFilter(f: BiquadFilterNode, band: EqBand) {
    f.frequency.value = band.freq
    f.Q.value = band.q
    f.gain.value = band.gainDb
    switch (band.type) {
      case 'bell':
        f.type = 'peaking'
        break
      case 'highshelf':
        f.type = 'highshelf'
        break
      case 'lowshelf':
        f.type = 'lowshelf'
        break
      case 'highpass':
        f.type = 'highpass'
        break
      case 'lowpass':
        f.type = 'lowpass'
        break
    }
  }

  return {
    input,
    output,
    update(p) {
      p.bands.forEach((band, i) => {
        if (filters[i]) applyBandToFilter(filters[i]!, band)
      })
    },
    dispose() {
      input.disconnect()
      filters.forEach((f) => f.disconnect())
      output.disconnect()
    },
  }
}
