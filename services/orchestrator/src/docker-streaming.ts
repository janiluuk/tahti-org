// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export const FFMPEG_IMAGE = process.env.FFMPEG_IMAGE ?? 'jrotting/ffmpeg:6-alpine'
export const RECORDINGS_VOLUME = process.env.RECORDINGS_VOLUME ?? 'tahti_stack_recordings'
export const ICECAST_BASE_URL = (process.env.ICECAST_BASE_URL ?? 'http://icecast:8000').replace(
  /\/$/,
  '',
)
export const DOCKER_NETWORK = process.env.CHANNEL_NETWORK ?? 'tahti-stack_default'
export const RTMP_INGEST_URL = (process.env.RTMP_INGEST_URL ?? 'rtmp://rtmp-ingest:1935').replace(
  /\/$/,
  '',
)
