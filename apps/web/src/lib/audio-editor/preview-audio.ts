// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { EditList } from '@tahti/audio-edit'
import { mergeCuts } from '@tahti/audio-edit'

export interface PreviewGraph {
  ctx: AudioContext
  analyser: AnalyserNode
  disconnect: () => void
}

export function attachPreviewGraph(audio: HTMLAudioElement, edit: EditList): PreviewGraph {
  const ctx = new AudioContext()
  const src = ctx.createMediaElementSource(audio)
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

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048

  let node: AudioNode = src
  node.connect(gain)
  node = gain

  if (edit.eq.enabled) {
    for (const f of filters) {
      node.connect(f)
      node = f
    }
  }

  if (edit.comp.enabled) {
    node.connect(comp)
    node = comp
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
    disconnect: () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      void ctx.close()
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
