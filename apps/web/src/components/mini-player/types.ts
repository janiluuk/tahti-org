// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type TrackReactionType = 'LOVE' | 'LAUGH' | 'SURPRISE' | 'HANDS_UP'

export interface TrackReactionItem {
  id: string
  type: TrackReactionType
  positionSec: number
  createdAt: string
}

export interface TracklistCue {
  startSec: number
  title: string
  artist?: string | null
}

export interface BroadcastReactionItem {
  emoji: string
  elapsedSec: number
}

export interface TrackPlaybackDetails {
  title: string
  artistName: string
  artistAvatarUrl: string | null
  channelSlug: string
  tracklist: TracklistCue[] | null
  peaks: number[] | null
  reactions: TrackReactionItem[]
  /** Flying-emoji reactions fired live during the original broadcast, if
   * this track was recorded from one — replayed at matching elapsedSec
   * during archive playback. Empty for tracks with no linked broadcast. */
  broadcastReactions: BroadcastReactionItem[]
}

export const REACTION_TYPES: { type: TrackReactionType; emoji: string; label: string }[] = [
  { type: 'LOVE', emoji: '❤️', label: 'Love' },
  { type: 'LAUGH', emoji: '😂', label: 'Laugh' },
  { type: 'SURPRISE', emoji: '😮', label: 'Surprise' },
  { type: 'HANDS_UP', emoji: '🙌', label: 'Hands up' },
]
