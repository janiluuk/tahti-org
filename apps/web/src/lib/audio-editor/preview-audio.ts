// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EditList } from '@tahti/audio-edit'
import { mergeCuts } from '@tahti/audio-edit'

export interface PreviewSource {
  ctx: AudioContext
  src: MediaElementAudioSourceNode
}

/**
 * `createMediaElementSource` may only be called once per `<audio>` element for its
 * entire lifetime (even across AudioContext instances), so the context and source
 * node are created once, cached per element, and reused while the downstream
 * processing chain is rebuilt on every edit-list change. The cache also absorbs
 * React 18 StrictMode's mount→cleanup→mount cycle in development.
 */
const sourceCache = new WeakMap<HTMLAudioElement, PreviewSource>()

export function createPreviewSource(audio: HTMLAudioElement): PreviewSource {
  const cached = sourceCache.get(audio)
  if (cached && cached.ctx.state !== 'closed') return cached
  const ctx = new AudioContext()
  const src = ctx.createMediaElementSource(audio)
  const source: PreviewSource = { ctx, src }
  sourceCache.set(audio, source)
  return source
}

export interface PreviewGraph {
  ctx: AudioContext
  analyser: AnalyserNode
  /** Tap before the compressor stage, for the gain-reduction meter (≈). */
  preCompAnalyser: AnalyserNode
  /** Tap after the compressor stage, for the gain-reduction meter (≈). */
  postCompAnalyser: AnalyserNode
  disconnect: () => void
}

export function attachPreviewGraph(
  source: PreviewSource,
  audio: HTMLAudioElement,
  edit: EditList,
): PreviewGraph {
  const { ctx, src } = source
  const gain = ctx.createGain()
  gain.gain.value = 10 ** (edit.gainDb / 20)

  if (edit.loudnorm.enabled && edit.loudnorm.measured) {
    const offset = edit.loudnorm.targetLufs - edit.loudnorm.measured.i
    gain.gain.value *= 10 ** (offset / 20)
  }

  const filters = edit.eq.bands.map(() => {
    const f = ctx.createBiquadFilter()
    f.type = 'peaking'
    return f
  })

  if (edit.eq.enabled) {
    edit.eq.bands.forEach((band, i) => {
      const f = filters[i]!
      f.frequency.value = band.freq
      f.Q.value = band.q
      f.gain.value = band.gainDb
    })
  }

  const comp = ctx.createDynamicsCompressor()
  if (edit.comp.enabled) {
    comp.threshold.value = edit.comp.thresholdDb
    comp.ratio.value = edit.comp.ratio
    comp.attack.value = edit.comp.attackMs / 1000
    comp.release.value = edit.comp.releaseMs / 1000
  }

  const limiter = ctx.createDynamicsCompressor()
  if (edit.limiter.enabled) {
    limiter.threshold.value = edit.limiter.ceilingDb
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = edit.limiter.releaseMs / 1000
  }

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048

  const preCompAnalyser = ctx.createAnalyser()
  preCompAnalyser.fftSize = 2048
  const postCompAnalyser = ctx.createAnalyser()
  postCompAnalyser.fftSize = 2048
  const silentSink = ctx.createGain()
  silentSink.gain.value = 0
  silentSink.connect(ctx.destination)
  preCompAnalyser.connect(silentSink)
  postCompAnalyser.connect(silentSink)

  let node: AudioNode = src
  node.connect(gain)
  node = gain

  if (edit.eq.enabled) {
    for (const f of filters) {
      node.connect(f)
      node = f
    }
  }

  node.connect(preCompAnalyser)

  if (edit.comp.enabled) {
    node.connect(comp)
    node = comp
  }

  node.connect(postCompAnalyser)

  if (edit.limiter.enabled) {
    node.connect(limiter)
    node = limiter
  }

  node.connect(analyser)
  analyser.connect(ctx.destination)

  const mergedCuts = mergeCuts(edit.cuts)
  const onTimeUpdate = () => {
    const t = audio.currentTime
    for (const cut of mergedCuts) {
      if (t >= cut.start && t < cut.end) {
        audio.currentTime = cut.end
        break
      }
    }
  }
  audio.addEventListener('timeupdate', onTimeUpdate)

  return {
    ctx,
    analyser,
    preCompAnalyser,
    postCompAnalyser,
    disconnect: () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      src.disconnect()
    },
  }
}

export function readPeakLevel(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(buf)
  let peak = 0
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i]! - 128) / 128
    if (v > peak) peak = v
  }
  return peak
}

function peakDb(analyser: AnalyserNode): number {
  const peak = readPeakLevel(analyser)
  return peak <= 0 ? -100 : 20 * Math.log10(peak)
}

/** Approximate gain reduction by comparing pre/post compressor peak levels. */
export function readGainReductionDb(pre: AnalyserNode, post: AnalyserNode): number {
  return Math.max(0, peakDb(pre) - peakDb(post))
}
