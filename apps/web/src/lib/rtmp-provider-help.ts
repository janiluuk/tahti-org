// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

/** Where artists get stream keys — shown in dashboard Multistream form. */
export const RTMP_PROVIDERS = [
  { value: 'YOUTUBE', label: 'YouTube Live' },
  { value: 'TWITCH', label: 'Twitch' },
  { value: 'FACEBOOK', label: 'Facebook Live' },
  { value: 'KICK', label: 'Kick' },
  { value: 'TIKTOK', label: 'TikTok Live (RTMP)' },
  { value: 'MIXCLOUD_LIVE', label: 'Mixcloud Live' },
  { value: 'INSTAGRAM', label: 'Instagram Live (RTMP)' },
  { value: 'CUSTOM', label: 'Custom RTMP' },
] as const

export type RtmpProviderValue = (typeof RTMP_PROVIDERS)[number]['value']

export const RTMP_PROVIDER_HELP: Record<
  RtmpProviderValue,
  { ingestHint: string; keySteps: string; docUrl?: string }
> = {
  YOUTUBE: {
    ingestHint: 'rtmp://a.rtmp.youtube.com/live2',
    keySteps: 'YouTube Studio → Create → Go live → Stream → copy the stream key (not an API key).',
    docUrl: 'https://studio.youtube.com/',
  },
  TWITCH: {
    ingestHint: 'rtmp://live.twitch.tv/app',
    keySteps: 'Twitch Dashboard → Settings → Stream → Primary Stream key.',
    docUrl: 'https://dashboard.twitch.tv/settings/stream',
  },
  FACEBOOK: {
    ingestHint: 'rtmps://live-api-s.facebook.com:443/rtmp',
    keySteps: 'Facebook Live Producer / Page → Use streaming software → copy stream key.',
    docUrl: 'https://live.fb.com/',
  },
  KICK: {
    ingestHint: 'rtmp://fa723fc1b171.ngwitch.tv/app',
    keySteps: 'Kick Creator Dashboard → stream settings → copy stream key.',
    docUrl: 'https://kick.com/dashboard',
  },
  TIKTOK: {
    ingestHint: 'rtmp://push-rtmp.tiktok.com/live/',
    keySteps:
      'TikTok Live Studio → RTMP settings → stream key (if RTMP is enabled for your account).',
  },
  MIXCLOUD_LIVE: {
    ingestHint: 'rtmp://broadcast.mixcloud.com/live',
    keySteps: 'Mixcloud Live broadcast settings → copy stream key.',
    docUrl: 'https://www.mixcloud.com/',
  },
  INSTAGRAM: {
    ingestHint: 'rtmps://live-upload.instagram.com:443/rtmp',
    keySteps:
      'Instagram Professional live / third-party streaming → RTMP URL + key (when offered).',
  },
  CUSTOM: {
    ingestHint: 'You provide the full RTMP URL',
    keySteps: 'Paste RTMP URL + stream key from the service (Restream, LinkedIn, radio CDN, etc.).',
  },
}
