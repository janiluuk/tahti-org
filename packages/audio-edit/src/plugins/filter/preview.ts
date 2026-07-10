// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FilterSlope } from '../../types.js'
import type { FilterParams } from './index.js'

const HP_LP_STAGE_COUNT: Record<FilterSlope, number> = {
  '12db': 1,
  '24db': 2,
  brickwall: 4,
}

/** Web Audio shelf Q: lower = gentler transition, roughly mirroring the ffmpeg width mapping. */
const SHELF_Q: Record<FilterSlope, number> = {
  '12db': 0.5,
  '24db': 1,
  brickwall: 2,
}

const SHELF_CUT_DB = -60

function buildNodes(audioCtx: AudioContext, params: FilterParams): BiquadFilterNode[] {
  const { mode, freq, slope } = params
  if (mode === 'highpass' || mode === 'lowpass') {
    return Array.from({ length: HP_LP_STAGE_COUNT[slope] }, () => {
      const node = audioCtx.createBiquadFilter()
      node.type = mode
      node.frequency.value = freq
      return node
    })
  }
  const node = audioCtx.createBiquadFilter()
  node.type = mode === 'highshelf' ? 'highshelf' : 'lowshelf'
  node.frequency.value = freq
  node.gain.value = SHELF_CUT_DB
  node.Q.value = SHELF_Q[slope]
  return [node]
}

export function createFilterPreviewNode(
  audioCtx: AudioContext,
  params: FilterParams,
): { input: AudioNode; output: AudioNode; update(p: FilterParams): void; dispose(): void } {
  const input = audioCtx.createGain()
  let nodes = buildNodes(audioCtx, params)
  nodes.reduce((prev, node) => (prev.connect(node), node), input as AudioNode)
  const output = audioCtx.createGain()
  nodes[nodes.length - 1]!.connect(output)

  return {
    input,
    output,
    update(p) {
      // Filter topology (stage count / node type) can change with mode+slope — rebuild the chain.
      input.disconnect()
      for (const node of nodes) node.disconnect()
      nodes = buildNodes(audioCtx, p)
      nodes.reduce((prev, node) => (prev.connect(node), node), input as AudioNode)
      nodes[nodes.length - 1]!.connect(output)
    },
    dispose() {
      input.disconnect()
      for (const node of nodes) node.disconnect()
      output.disconnect()
    },
  }
}
