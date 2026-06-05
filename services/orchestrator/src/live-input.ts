// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { BroadcastSource } from '@tahti/db'
import { ICECAST_BASE_URL } from './docker-streaming.js'
import { edgeEncoderRelayUrl } from './edge-encoder.js'

/** URL Liquidsoap `input.http` pulls for live audio. */
export function liveInputUrl(source: BroadcastSource, slug: string): string {
  if (source === 'RTMP') {
    return edgeEncoderRelayUrl(slug)
  }
  // ICECAST and WEBRTC (relay TBD) — artist mount on central Icecast
  return `${ICECAST_BASE_URL}/live/${slug}`
}
