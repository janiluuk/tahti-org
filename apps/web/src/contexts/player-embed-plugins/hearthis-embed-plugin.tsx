// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { hearthisEmbedSrc } from '@tahti/shared'

/** Player-embed "plugins" — a track whose audio lives entirely inside a
 * third-party iframe rather than the shared native <audio> element. Each
 * provider gets its own small module like this one; player-context.tsx only
 * needs to know a track carries a `PlayerEmbedSource` and route around its
 * own <audio>-element logic, not any provider-specific detail. */
export const HEARTHIS_EMBED_PROVIDER = 'HEARTHIS' as const

export type PlayerEmbedSource = {
  provider: typeof HEARTHIS_EMBED_PROVIDER
  embedUri: string
}

/**
 * hearthis.at's widget has no documented postMessage control API (unlike
 * Mixcloud/SoundCloud/YouTube's widget APIs — checked), so this plugin can't
 * proxy play/pause/seek into the shared mini-player transport the way a real
 * `<audio>`-backed track does. Instead it mounts hearthis's own iframe widget
 * directly, and lets the widget's own controls drive playback — the global
 * player wraps it for title/artwork/queue purposes (it's a first-class track
 * in the queue, survives navigation like any other), but its own play/pause/
 * seek go inert for as long as this surface is the active track; see the
 * `disabled` styling player-context.tsx's consumers apply for `track.embed`.
 */
export function HearthisEmbedSurface({
  embedUri,
  title,
  autoplay,
}: {
  embedUri: string
  title: string
  autoplay: boolean
}) {
  return (
    <iframe
      key={embedUri}
      title={`${title} — hearthis.at player`}
      src={hearthisEmbedSrc(embedUri, { autoplay })}
      className="player-embed-surface"
      allow="autoplay"
      loading="lazy"
    />
  )
}
