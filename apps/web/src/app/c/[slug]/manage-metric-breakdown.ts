// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ManageStats } from './_manage-panel'

export type ManageMetricKey =
  'audioBitrate' | 'listeners' | 'listenerPeak' | 'plays' | 'likes' | 'reposts' | 'duration'

export interface MetricBreakdownItem {
  label: string
  value: string
  note: string
}

export interface MetricBreakdown {
  key: ManageMetricKey
  label: string
  value: string
  summary: string
  items: MetricBreakdownItem[]
}

export const MANAGE_METRIC_KEYS: ManageMetricKey[] = [
  'audioBitrate',
  'listeners',
  'listenerPeak',
  'plays',
  'likes',
  'reposts',
  'duration',
]

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function buildMetricBreakdown(stats: ManageStats, key: ManageMetricKey): MetricBreakdown {
  const demoListeners = Math.max(stats.listeners, 24)
  const demoPlays = Math.max(stats.plays, 186)
  const demoLikes = Math.max(stats.likes, 31)
  const demoReposts = Math.max(stats.reposts, 8)

  switch (key) {
    case 'audioBitrate':
      return {
        key,
        label: 'Audio Bitrate',
        value: stats.audioBitrateKbps != null ? `${stats.audioBitrateKbps} kbps` : 'Not live',
        summary: 'Stream delivery quality and stability during this broadcast.',
        items: [
          { label: '30-minute average', value: '318 kbps', note: 'Demo rolling average' },
          { label: 'Signal stability', value: '99.4%', note: 'Packets delivered cleanly' },
          { label: 'Audio format', value: '48 kHz stereo', note: 'Current ingest format' },
          { label: 'Dropouts', value: '2', note: 'Short interruptions detected' },
        ],
      }
    case 'listeners':
      return {
        key,
        label: 'Listeners',
        value: String(stats.listeners),
        summary: 'Who is listening now and how this audience found the channel.',
        items: [
          { label: 'Unique today', value: String(demoListeners * 4 + 17), note: 'Demo estimate' },
          { label: 'Returning listeners', value: '42%', note: 'Heard this channel before' },
          { label: 'Channel followers', value: '61%', note: 'Already follow the artist' },
          { label: 'New listeners', value: '39%', note: 'First visit this week' },
        ],
      }
    case 'listenerPeak':
      return {
        key,
        label: 'Listener Peak',
        value: String(stats.listenerPeak),
        summary: 'The strongest concurrent audience moment in the current session.',
        items: [
          { label: 'Peak reached', value: '21:42', note: 'Demo local time' },
          {
            label: 'Average concurrent',
            value: String(Math.max(12, Math.round(demoListeners * 0.72))),
            note: 'Across this session',
          },
          { label: 'Previous broadcast', value: '+18%', note: 'Demo comparison' },
          { label: 'Peak held for', value: '6m 24s', note: 'Within 10% of the peak' },
        ],
      }
    case 'plays':
      return {
        key,
        label: 'Plays',
        value: String(stats.plays),
        summary: 'Starts across the channel, artist profile, and shared players.',
        items: [
          {
            label: 'Last 24 hours',
            value: String(Math.round(demoPlays * 0.22)),
            note: 'Demo plays',
          },
          { label: 'Channel page', value: '64%', note: 'Started directly here' },
          { label: 'Artist profile', value: '23%', note: 'Started from Archive' },
          { label: 'Average completion', value: '73%', note: 'For completed recordings' },
        ],
      }
    case 'likes':
      return {
        key,
        label: 'Likes',
        value: String(stats.likes),
        summary: 'Audience appreciation across this channel and its recordings.',
        items: [
          { label: 'This week', value: String(Math.round(demoLikes * 0.58)), note: 'Demo likes' },
          { label: 'New followers', value: '7', note: 'Liked, then followed' },
          { label: 'Listener conversion', value: '12.8%', note: 'Listeners who left a like' },
          { label: 'Top moment', value: '38:14', note: 'Most-liked timestamp' },
        ],
      }
    case 'reposts':
      return {
        key,
        label: 'Reposts',
        value: String(stats.reposts),
        summary: 'Shares that carried the broadcast or recording into another audience.',
        items: [
          { label: 'This week', value: String(Math.max(3, demoReposts - 2)), note: 'Demo reposts' },
          { label: 'Profile shares', value: '68%', note: 'Shared to a Tahti profile' },
          { label: 'External shares', value: '32%', note: 'Copied or shared elsewhere' },
          { label: 'Listeners reached', value: '94', note: 'Demo secondary reach' },
        ],
      }
    case 'duration':
      return {
        key,
        label: 'Duration',
        value: formatDuration(stats.liveDurationSec),
        summary: 'Broadcast timing, listening depth, and session milestones.',
        items: [
          { label: 'Average listen', value: '34m 18s', note: 'Demo session depth' },
          { label: 'Longest listen', value: '1h 47m', note: 'Single listener session' },
          { label: 'Audience retention', value: '76%', note: 'Still listening after 15m' },
          { label: 'Next milestone', value: '3 hours', note: 'Broadcast duration goal' },
        ],
      }
  }
}
