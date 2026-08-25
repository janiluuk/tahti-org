// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections — hearthis.at widget embed. Unlike Mixcloud's
 * widget (which takes the cloudcast URL), hearthis.at's iframe embed is keyed
 * by the track's numeric id: https://hearthis.at/embed/{id}/... — confirmed
 * from the `Embed(<id>)` call embedded in a live hearthis.at track page.
 */
export function hearthisEmbedSrc(trackId: string, opts?: { autoplay?: boolean }): string {
  const params = new URLSearchParams({
    hcolor: '55acee',
    color: '',
    style: '2',
    block_size: '2',
    block_space: '2',
    background: '1',
    // The current HearThis widget renders its play icons hidden until its
    // waveform/cover UI initializes. Hiding both leaves no clickable control.
    waveform: '1',
    cover: '1',
    // Default off: several callers mount this iframe unconditionally (not
    // behind a listener click), so it must not start audio on its own. Pass
    // autoplay: true only when the iframe is created directly inside a
    // listener's own "Play" click — that click is the user gesture the
    // widget's autoplay needs, so it starts immediately instead of requiring
    // a second click on the widget's own internal play button.
    autoplay: opts?.autoplay ? '1' : '0',
    css: '',
  })
  return `https://hearthis.at/embed/${encodeURIComponent(trackId)}/transparent_black/?${params.toString()}`
}
