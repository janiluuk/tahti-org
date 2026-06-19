// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel } from '@tahti/ui'
import { ImportPageLayout, ImportServiceTags } from '../_import-page-layout'
import { UrlPasteClient } from './_url-paste-client'

const SUPPORTED_SERVICES = [
  'Spotify — albums, singles, tracks',
  'Apple Music — albums, singles, tracks',
  'YouTube — videos, playlists',
  'Tidal — albums, tracks',
  'Deezer — albums, tracks',
  'Amazon Music — albums, tracks',
  'Bandcamp — albums, tracks',
  'SoundCloud — tracks, playlists',
]

export default function UrlPastePage() {
  return (
    <ImportPageLayout
      service="url"
      title="Paste a URL"
      description="Create a smart link page on Tahti for content that lives on Spotify, Apple Music, YouTube, or other platforms. No audio file needed — listeners click through to the original service."
      asideTitle="Supported services"
      aside={<ImportServiceTags services={SUPPORTED_SERVICES} />}
    >
      <Panel
        title="Add streaming links"
        description="Paste one or more URLs. Tahti detects the service and builds a single smart link page."
        className="import-page__panel"
      >
        <UrlPasteClient />
      </Panel>
    </ImportPageLayout>
  )
}
