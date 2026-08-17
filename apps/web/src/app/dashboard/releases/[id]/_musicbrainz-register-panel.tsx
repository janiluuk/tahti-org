// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { buildMusicbrainzSeedUrl, type MusicbrainzSeedRelease } from '@tahti/shared'
import {
  getMusicbrainzDefault,
  getMusicbrainzStatus,
  setMusicbrainzDefault,
} from '../../release-actions'

export function MusicbrainzRegisterPanel({ release }: { release: MusicbrainzSeedRelease }) {
  const [status, setStatus] = useState<{
    connected: boolean
    configured: boolean
    username: string | null
  } | null>(null)
  const [pref, setPref] = useState<boolean | null | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    void getMusicbrainzStatus().then(setStatus)
    void getMusicbrainzDefault().then(setPref)
  }, [])

  if (!status || pref === undefined) return null
  if (!status.configured) return null
  if (pref === false) return null

  const seedUrl = buildMusicbrainzSeedUrl(release)

  function savePref(value: boolean) {
    setPref(value)
    startTransition(() => {
      void setMusicbrainzDefault(value)
    })
  }

  if (!status.connected) {
    return (
      <div className="studio-notice studio-mt-sm">
        <span>Connect MusicBrainz to register this release there.</span>{' '}
        <a href="/api/me/musicbrainz/oauth/start" className="ui-btn ui-btn--sm ui-btn--ghost">
          Connect account
        </a>
      </div>
    )
  }

  if (pref === true) {
    return (
      <div className="studio-notice studio-mt-sm">
        <a
          href={seedUrl}
          target="_blank"
          rel="noreferrer"
          className="ui-btn ui-btn--sm ui-btn--primary"
        >
          Register with MusicBrainz →
        </a>
        <span className="studio-text-muted-sm studio-ml-xs">
          Opens MusicBrainz&rsquo;s Add Release form, pre-filled — review and submit it there
          {status.username ? ` as ${status.username}` : ''}.
        </span>
      </div>
    )
  }

  return (
    <div className="studio-notice studio-mt-sm">
      <p className="studio-text-sm">
        Register this release with MusicBrainz? Opens their Add Release form pre-filled — you review
        and submit it yourself{status.username ? ` as ${status.username}` : ''}.
      </p>
      <div className="studio-actions studio-actions--sm studio-mt-xs">
        <a
          href={seedUrl}
          target="_blank"
          rel="noreferrer"
          className="ui-btn ui-btn--sm ui-btn--primary"
        >
          Register →
        </a>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          disabled={isPending}
          onClick={() => savePref(true)}
        >
          Always offer this
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          disabled={isPending}
          onClick={() => savePref(false)}
        >
          Don&rsquo;t ask again
        </button>
      </div>
    </div>
  )
}
