// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'

import { compileGain, DEFAULT_GAIN_PARAMS, gainChainSummary } from './gain/index.js'
import { compileEq, DEFAULT_EQ_PARAMS, eqChainSummary } from './eq/index.js'
import { compileComp, DEFAULT_COMP_PARAMS, compChainSummary } from './comp/index.js'
import { compileLimiter, DEFAULT_LIMITER_PARAMS, limiterChainSummary } from './limiter/index.js'
import { compileFilter, DEFAULT_FILTER_PARAMS, filterChainSummary } from './filter/index.js'

const CTX = { inputLabel: '[in]', outputLabel: '[out]' }

// ── Gain ────────────────────────────────────────────────────────────────────
describe('gain plugin', () => {
  it('returns null when db=0 and normalize disabled', () => {
    expect(compileGain(DEFAULT_GAIN_PARAMS, CTX)).toBeNull()
  })

  it('emits volume filter for non-zero db', () => {
    const step = compileGain({ ...DEFAULT_GAIN_PARAMS, db: 3 }, CTX)
    expect(step?.graph).toContain('volume=3dB')
    expect(step?.outLabel).toBe('[out]')
  })

  it('emits loudnorm filter when normalize.enabled', () => {
    const params = {
      ...DEFAULT_GAIN_PARAMS,
      normalize: { enabled: true, targetLufs: -14, targetTp: -1.5 },
    }
    const step = compileGain(params, CTX)
    expect(step?.graph).toContain('loudnorm=')
    expect(step?.graph).toContain('I=-14')
  })

  it('includes measured values in linear pass when provided', () => {
    const params = {
      ...DEFAULT_GAIN_PARAMS,
      normalize: { enabled: true, targetLufs: -14, targetTp: -1.5 },
      measured: { i: -16, tp: -2, lra: 8, thresh: -26 },
    }
    const step = compileGain(params, CTX)
    expect(step?.graph).toContain('linear=true')
    expect(step?.graph).toContain('measured_I=-16')
  })

  it('chainSummary reflects db and normalize state', () => {
    expect(gainChainSummary(DEFAULT_GAIN_PARAMS, false)).toBe('bypassed')
    expect(gainChainSummary(DEFAULT_GAIN_PARAMS, true)).toBe('0.0 dB')
    const withNorm = {
      ...DEFAULT_GAIN_PARAMS,
      normalize: { enabled: true, targetLufs: -14, targetTp: -1.5 },
    }
    expect(gainChainSummary(withNorm, true)).toContain('LUFS')
  })
})

// ── EQ ──────────────────────────────────────────────────────────────────────
describe('eq plugin', () => {
  it('returns null when all bands are 0 dB (no-op)', () => {
    expect(compileEq(DEFAULT_EQ_PARAMS, CTX)).toBeNull()
  })

  it('emits equalizer filters for active bell bands', () => {
    const params = {
      bands: [
        { freq: 80, q: 1, gainDb: 2, type: 'bell' as const },
        { freq: 1200, q: 1, gainDb: 0, type: 'bell' as const },
        { freq: 9000, q: 0.7, gainDb: 1.5, type: 'bell' as const },
      ],
    }
    const step = compileEq(params, CTX)
    expect(step?.graph).toContain('equalizer=')
    // Only 2 active bands (middle is 0 dB)
    const eqCount = (step?.graph.match(/equalizer=/g) ?? []).length
    expect(eqCount).toBe(2)
  })

  it('highshelf/lowshelf bands use ffmpeg treble/bass, not the equalizer peaking filter', () => {
    // ffmpeg's `equalizer` filter is always a two-pole peaking filter — it has no shelf mode.
    // `t=h`/`t=l` there selects the width *unit* (Hz), not a shelf shape, so using it for a
    // "highshelf" band silently produced a near-zero-width peaking notch instead of a shelf.
    const params = {
      bands: [{ freq: 9000, q: 0.7, gainDb: 1.5, type: 'highshelf' as const }],
    }
    const step = compileEq(params, CTX)
    expect(step?.graph).toContain('treble=f=9000:')
    expect(step?.graph).not.toContain('equalizer=')

    const lowParams = {
      bands: [{ freq: 200, q: 0.7, gainDb: -3, type: 'lowshelf' as const }],
    }
    const lowStep = compileEq(lowParams, CTX)
    expect(lowStep?.graph).toContain('bass=f=200:')
  })

  it('two simultaneous EQ instances compile independently', () => {
    const params = { bands: [{ freq: 80, q: 1, gainDb: 2, type: 'bell' as const }] }
    const step1 = compileEq(params, { inputLabel: '[in1]', outputLabel: '[out1]' })
    const step2 = compileEq(params, { inputLabel: '[in2]', outputLabel: '[out2]' })
    expect(step1?.graph).toContain('[in1]')
    expect(step2?.graph).toContain('[in2]')
    expect(step1?.outLabel).toBe('[out1]')
    expect(step2?.outLabel).toBe('[out2]')
  })

  it('chainSummary shows band gains', () => {
    const params = {
      bands: [
        { freq: 80, q: 1, gainDb: 2, type: 'bell' as const },
        { freq: 1200, q: 1, gainDb: 0, type: 'bell' as const },
        { freq: 9000, q: 0.7, gainDb: 1.5, type: 'highshelf' as const },
      ],
    }
    expect(eqChainSummary(params, true)).toBe('+2.0 · +0.0 · +1.5')
    expect(eqChainSummary(params, false)).toBe('bypassed')
  })
})

// ── Comp ─────────────────────────────────────────────────────────────────────
describe('comp plugin', () => {
  it('always emits acompressor filter (never null)', () => {
    const step = compileComp(DEFAULT_COMP_PARAMS, CTX)
    expect(step).not.toBeNull()
    expect(step?.graph).toContain('acompressor=')
  })

  it('embeds all params in the filter string', () => {
    const step = compileComp(DEFAULT_COMP_PARAMS, CTX)
    expect(step?.graph).toContain('threshold=-18dB')
    expect(step?.graph).toContain('ratio=3')
    expect(step?.graph).toContain('attack=25')
    expect(step?.graph).toContain('release=250')
  })

  it('converts makeupDb to a linear multiplier — ffmpeg acompressor `makeup` is linear (range [1, 64]), not dB', () => {
    // At the default 0dB makeup, ffmpeg's valid range starts at 1 (not 0) — passing 0
    // straight through crashes the whole render with "out of range".
    const zero = compileComp({ ...DEFAULT_COMP_PARAMS, makeupDb: 0 }, CTX)
    expect(zero?.graph).toContain('makeup=1.000000')

    const six = compileComp({ ...DEFAULT_COMP_PARAMS, makeupDb: 6 }, CTX)
    expect(six?.graph).toContain(`makeup=${Math.pow(10, 6 / 20).toFixed(6)}`)
  })

  it('chainSummary shows threshold, ratio, attack', () => {
    expect(compChainSummary(DEFAULT_COMP_PARAMS, true)).toBe('-18 dB · 3:1 · 25 ms')
    expect(compChainSummary(DEFAULT_COMP_PARAMS, false)).toBe('bypassed')
  })
})

// ── Limiter ──────────────────────────────────────────────────────────────────
describe('limiter plugin', () => {
  it('always emits alimiter filter (never null)', () => {
    const step = compileLimiter(DEFAULT_LIMITER_PARAMS, CTX)
    expect(step).not.toBeNull()
    expect(step?.graph).toContain('alimiter=')
  })

  it('converts ceilingDb to linear amplitude', () => {
    const step = compileLimiter({ ceilingDb: 0, releaseMs: 50 }, CTX)
    expect(step?.graph).toContain('limit=1.0')
  })

  it('disables ffmpeg alimiter auto-leveling — otherwise it boosts audio that never approached the ceiling', () => {
    const step = compileLimiter(DEFAULT_LIMITER_PARAMS, CTX)
    expect(step?.graph).toContain('level=0')
  })

  it('chainSummary shows ceiling and bypassed state', () => {
    expect(limiterChainSummary(DEFAULT_LIMITER_PARAMS, true)).toBe('-1 dBTP ceiling')
    expect(limiterChainSummary(DEFAULT_LIMITER_PARAMS, false)).toBe('bypassed')
  })
})

// ── Filter ───────────────────────────────────────────────────────────────────
describe('filter plugin', () => {
  it('highpass emits a single poles=2 stage at the 12dB slope', () => {
    const step = compileFilter({ mode: 'highpass', freq: 100, slope: '12db' }, CTX)
    expect(step?.graph).toBe('[in]highpass=f=100:poles=2[out]')
  })

  it('lowpass cascades two poles=2 stages at the 24dB slope', () => {
    const step = compileFilter({ mode: 'lowpass', freq: 8000, slope: '24db' }, CTX)
    expect(step?.graph).toBe('[in]lowpass=f=8000:poles=2,lowpass=f=8000:poles=2[out]')
  })

  it('brickwall slope cascades more stages than 12db/24db', () => {
    const twelve = compileFilter({ mode: 'highpass', freq: 100, slope: '12db' }, CTX)
    const twentyFour = compileFilter({ mode: 'highpass', freq: 100, slope: '24db' }, CTX)
    const brick = compileFilter({ mode: 'highpass', freq: 100, slope: 'brickwall' }, CTX)
    const stageCount = (graph: string) => (graph.match(/highpass=/g) ?? []).length
    expect(stageCount(twelve!.graph)).toBe(1)
    expect(stageCount(twentyFour!.graph)).toBe(2)
    expect(stageCount(brick!.graph)).toBeGreaterThan(stageCount(twentyFour!.graph))
  })

  it('highshelf/lowshelf use ffmpeg treble/bass shelf filters, not equalizer', () => {
    // ffmpeg's `equalizer` is always a peaking filter — it has no shelf `t=` type, despite
    // `t=h`/`t=l` looking like one (those just pick the width unit). The real shelf filters
    // are the dedicated `treble` (highshelf) / `bass` (lowshelf) filters.
    const hs = compileFilter({ mode: 'highshelf', freq: 5000, slope: '12db' }, CTX)
    const ls = compileFilter({ mode: 'lowshelf', freq: 200, slope: '12db' }, CTX)
    expect(hs?.graph).toContain('treble=f=5000:')
    expect(ls?.graph).toContain('bass=f=200:')
    expect(hs?.graph).not.toContain('equalizer=')
    expect(ls?.graph).not.toContain('equalizer=')
  })

  it('chainSummary shows mode, frequency, and slope', () => {
    expect(filterChainSummary(DEFAULT_FILTER_PARAMS, true)).toBe('Highpass · 80 Hz · 12 dB/oct')
    expect(filterChainSummary(DEFAULT_FILTER_PARAMS, false)).toBe('bypassed')
  })
})
