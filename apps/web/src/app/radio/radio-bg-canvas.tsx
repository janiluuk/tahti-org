// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { BgCanvas } from '@/components/ui/bg-canvas'
import { usePlayer } from '@/contexts/player-context'

/** Wires the shared player's audio analyser into the background so the Three.js
 * scene actually reacts to Tahti Radio's audio, same as the channel page does. */
export function RadioBgCanvas() {
  const { analyser } = usePlayer()
  return <BgCanvas analyser={analyser} variant="subtle" />
}
