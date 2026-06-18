// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { UrlPasteClient } from './_url-paste-client'

export default function UrlPastePage() {
  return (
    <div className="import-page">
      <div className="import-page__header">
        <Link href="/dashboard/upload" className="collection-editor__back">
          ← Add content
        </Link>
        <h1 className="import-page__title">Paste a URL</h1>
      </div>

      <div className="import-page__body">
        <div className="import-page__hero">
          <span className="import-page__service-icon" aria-hidden>
            ⊞
          </span>
          <p className="import-page__desc">
            Create a smart link page on Tahti for content that lives on Spotify, Apple Music,
            YouTube, or other platforms. No audio file needed — listeners click through to the
            original platform.
          </p>
        </div>

        <UrlPasteClient />

        <div className="import-page__steps">
          <h2 className="import-page__steps-title">Supported services</h2>
          <ul className="import-page__service-list">
            <li>Spotify — albums, singles, tracks</li>
            <li>Apple Music — albums, singles, tracks</li>
            <li>YouTube — videos, playlists</li>
            <li>Tidal — albums, tracks</li>
            <li>Deezer — albums, tracks</li>
            <li>Amazon Music — albums, tracks</li>
            <li>Bandcamp — albums, tracks</li>
            <li>SoundCloud — tracks, playlists</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
