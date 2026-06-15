// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDefaultEditList } from '@tahti/audio-edit'
import {
  createPreviewSource,
  attachPreviewGraph,
  readPeakLevel,
  readGainReductionDb,
} from './preview-audio.js'

function createMockAudioParam(initial = 0) {
  return { value: initial }
}

function createMockNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockAnalyser() {
  return {
    ...createMockNode(),
    fftSize: 0,
    getByteTimeDomainData: vi.fn(),
  }
}

function createMockAudioContext(state: AudioContextState = 'running') {
  const destination = createMockNode()
  return {
    state,
    destination,
    createGain: vi.fn(() => ({ ...createMockNode(), gain: createMockAudioParam(1) })),
    createBiquadFilter: vi.fn(() => ({
      ...createMockNode(),
      type: '',
      frequency: createMockAudioParam(),
      Q: createMockAudioParam(),
      gain: createMockAudioParam(),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      ...createMockNode(),
      threshold: createMockAudioParam(),
      ratio: createMockAudioParam(),
      attack: createMockAudioParam(),
      release: createMockAudioParam(),
    })),
    createAnalyser: vi.fn(() => createMockAnalyser()),
    createMediaElementSource: vi.fn(() => createMockNode()),
    close: vi.fn(),
  }
}

function createMockAudioElement() {
  const listeners = new Map<string, () => void>()
  return {
    currentTime: 0,
    addEventListener: vi.fn((event: string, handler: () => void) => {
      listeners.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string) => {
      listeners.delete(event)
    }),
    __listeners: listeners,
  }
}

describe('createPreviewSource', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates and caches a source per audio element', () => {
    const ctx = createMockAudioContext()
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ctx),
    )
    const audio = createMockAudioElement() as unknown as HTMLAudioElement

    const first = createPreviewSource(audio)
    const second = createPreviewSource(audio)

    expect(second).toBe(first)
    expect(ctx.createMediaElementSource).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh source if the cached context is closed', () => {
    const ctx1 = createMockAudioContext('running')
    const ctx2 = createMockAudioContext('running')
    let call = 0
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => (call++ === 0 ? ctx1 : ctx2)),
    )
    const audio = createMockAudioElement() as unknown as HTMLAudioElement

    const first = createPreviewSource(audio)
    ;(first.ctx as unknown as { state: AudioContextState }).state = 'closed'
    const second = createPreviewSource(audio)

    expect(second).not.toBe(first)
    expect(second.ctx).toBe(ctx2)
  })
})

describe('attachPreviewGraph', () => {
  function build(editOverrides: Partial<ReturnType<typeof createDefaultEditList>> = {}) {
    const ctx = createMockAudioContext()
    const src = createMockNode()
    const audio = createMockAudioElement()
    const edit = { ...createDefaultEditList(100), ...editOverrides }

    const graph = attachPreviewGraph(
      { ctx: ctx as unknown as AudioContext, src: src as unknown as MediaElementAudioSourceNode },
      audio as unknown as HTMLAudioElement,
      edit,
    )

    return { ctx, src, audio, edit, graph }
  }

  it('applies gainDb to the gain node', () => {
    const { ctx } = build({ gainDb: 6 })
    const gainNode = ctx.createGain.mock.results[0]!.value as { gain: { value: number } }
    expect(gainNode.gain.value).toBeCloseTo(10 ** (6 / 20))
  })

  it('applies loudnorm offset on top of gainDb when measured loudness is present', () => {
    const { ctx } = build({
      gainDb: 0,
      loudnorm: {
        enabled: true,
        targetLufs: -14,
        targetTp: -1.5,
        measured: { i: -20, tp: -3, lra: 5, thresh: -30 },
      },
    })
    const gainNode = ctx.createGain.mock.results[0]!.value as { gain: { value: number } }
    // offset = targetLufs - measured.i = -14 - (-20) = 6
    expect(gainNode.gain.value).toBeCloseTo(10 ** (6 / 20))
  })

  it('configures EQ filters when eq is enabled', () => {
    const { ctx, edit } = build({
      eq: {
        enabled: true,
        bands: [{ freq: 100, gainDb: 3, q: 0.7 }],
      },
    })
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(edit.eq.bands.length)
    const filter = ctx.createBiquadFilter.mock.results[0]!.value as {
      frequency: { value: number }
      gain: { value: number }
      Q: { value: number }
    }
    expect(filter.frequency.value).toBe(100)
    expect(filter.gain.value).toBe(3)
    expect(filter.Q.value).toBe(0.7)
  })

  it('does not configure compressor or limiter params when disabled', () => {
    const { ctx } = build()
    const comp = ctx.createDynamicsCompressor.mock.results[0]!.value as {
      threshold: { value: number }
    }
    const limiter = ctx.createDynamicsCompressor.mock.results[1]!.value as {
      threshold: { value: number }
    }
    expect(comp.threshold.value).toBe(0)
    expect(limiter.threshold.value).toBe(0)
  })

  it('configures compressor and limiter params when enabled', () => {
    const { ctx } = build({
      comp: {
        enabled: true,
        thresholdDb: -18,
        ratio: 4,
        attackMs: 10,
        releaseMs: 100,
        makeupDb: 0,
      },
      limiter: { enabled: true, ceilingDb: -1, releaseMs: 50 },
    })
    const comp = ctx.createDynamicsCompressor.mock.results[0]!.value as {
      threshold: { value: number }
      ratio: { value: number }
      attack: { value: number }
      release: { value: number }
    }
    const limiter = ctx.createDynamicsCompressor.mock.results[1]!.value as {
      threshold: { value: number }
      ratio: { value: number }
      release: { value: number }
    }
    expect(comp.threshold.value).toBe(-18)
    expect(comp.ratio.value).toBe(4)
    expect(comp.attack.value).toBeCloseTo(0.01)
    expect(comp.release.value).toBeCloseTo(0.1)
    expect(limiter.threshold.value).toBe(-1)
    expect(limiter.ratio.value).toBe(20)
    expect(limiter.release.value).toBeCloseTo(0.05)
  })

  it('registers a timeupdate listener that skips merged cut regions', () => {
    const { audio } = build({
      cuts: [
        { start: 5, end: 10 },
        { start: 9, end: 12 },
      ],
    })

    const onTimeUpdate = audio.__listeners.get('timeupdate')
    expect(onTimeUpdate).toBeTruthy()

    audio.currentTime = 7
    onTimeUpdate!()
    expect(audio.currentTime).toBe(12)
  })

  it('leaves currentTime untouched when outside any cut', () => {
    const { audio } = build({ cuts: [{ start: 5, end: 10 }] })
    const onTimeUpdate = audio.__listeners.get('timeupdate')!

    audio.currentTime = 20
    onTimeUpdate()
    expect(audio.currentTime).toBe(20)
  })

  it('disconnect removes the timeupdate listener and disconnects the source', () => {
    const { audio, src, graph } = build()

    graph.disconnect()

    expect(audio.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    expect(src.disconnect).toHaveBeenCalledTimes(1)
  })
})

describe('readPeakLevel', () => {
  it('returns the maximum normalized deviation from the midpoint', () => {
    const analyser = createMockAnalyser()
    analyser.fftSize = 4
    analyser.getByteTimeDomainData.mockImplementation((buf: Uint8Array) => {
      buf.set([128, 192, 64, 130])
    })

    const peak = readPeakLevel(analyser as unknown as AnalyserNode)
    expect(peak).toBeCloseTo(64 / 128)
  })

  it('returns 0 for silence', () => {
    const analyser = createMockAnalyser()
    analyser.fftSize = 4
    analyser.getByteTimeDomainData.mockImplementation((buf: Uint8Array) => {
      buf.fill(128)
    })

    expect(readPeakLevel(analyser as unknown as AnalyserNode)).toBe(0)
  })
})

describe('readGainReductionDb', () => {
  it('returns 0 when pre and post levels are equal', () => {
    const analyser = createMockAnalyser()
    analyser.fftSize = 4
    analyser.getByteTimeDomainData.mockImplementation((buf: Uint8Array) => {
      buf.set([128, 192, 64, 128])
    })

    const reduction = readGainReductionDb(
      analyser as unknown as AnalyserNode,
      analyser as unknown as AnalyserNode,
    )
    expect(reduction).toBe(0)
  })

  it('returns a positive value when the post-stage level is lower', () => {
    const pre = createMockAnalyser()
    pre.fftSize = 4
    pre.getByteTimeDomainData.mockImplementation((buf: Uint8Array) => {
      buf.set([128, 192, 64, 128])
    })

    const post = createMockAnalyser()
    post.fftSize = 4
    post.getByteTimeDomainData.mockImplementation((buf: Uint8Array) => {
      buf.set([128, 160, 96, 128])
    })

    const reduction = readGainReductionDb(
      pre as unknown as AnalyserNode,
      post as unknown as AnalyserNode,
    )
    expect(reduction).toBeGreaterThan(0)
  })
})
