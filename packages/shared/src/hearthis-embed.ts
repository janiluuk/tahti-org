// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections — hearthis.at widget embed. Unlike Mixcloud's
 * widget (which takes the cloudcast URL), hearthis.at's iframe embed is keyed
 * by the track's numeric id: https://hearthis.at/embed/{id}/... — confirmed
 * from the `Embed(<id>)` call embedded in a live hearthis.at track page.
 */
export function hearthisEmbedSrc(trackId: string): string {
  const params = new URLSearchParams({
    hcolor: '55acee',
    style: '2',
    background: '1',
    waveform: '0',
    cover: '0',
    autoplay: '0',
  })
  return `https://hearthis.at/embed/${encodeURIComponent(trackId)}/transparent_black/?${params.toString()}`
}
