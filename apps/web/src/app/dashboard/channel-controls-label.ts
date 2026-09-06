// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export function channelPlaylistLabel(playlists: Array<{ name: string; active: boolean }>): string {
  return playlists.find((playlist) => playlist.active)?.name ?? 'Default rotation'
}
