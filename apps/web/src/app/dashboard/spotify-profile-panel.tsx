// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, ButtonIcon } from '@tahti/ui'
import {
  linkSpotifyProfile,
  unlinkSpotifyProfile,
  type SpotifyArtistProfile,
} from './spotify-profile-actions'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

function coverProxySrc(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  return `${apiUrl}/api/v1/imports/spotify/cover?url=${encodeURIComponent(imageUrl)}`
}

export function SpotifyProfilePanel({
  initial,
  configured,
}: {
  initial: SpotifyArtistProfile | null
  configured: boolean
}) {
  const router = useRouter()
  const [profile, setProfile] = useState(initial)
  const [artistUrl, setArtistUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    if (!artistUrl.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await linkSpotifyProfile(artistUrl.trim())
      if (res.error || !res.profile) {
        setError(res.error ?? 'Could not link that artist')
        return
      }
      setProfile(res.profile)
      setArtistUrl('')
      router.refresh()
    })
  }

  function unlink() {
    if (!confirm('Remove your linked Spotify artist profile?')) return
    setError(null)
    startTransition(async () => {
      const res = await unlinkSpotifyProfile()
      if (res.error) {
        setError(res.error)
        return
      }
      setProfile(null)
      router.refresh()
    })
  }

  if (!configured) {
    return (
      <div className="import-connect">
        <div className="studio-text-strong-sm studio-mb-sm">Spotify artist profile</div>
        <p className="import-connect__note import-connect__note--muted">
          Spotify import needs a platform API key that hasn&apos;t been set up yet.
        </p>
        <a href="/admin/settings/vendors" className="ui-btn ui-btn--secondary ui-btn--sm">
          Configure
        </a>
      </div>
    )
  }

  const cover = coverProxySrc(profile?.imageUrl ?? null)

  return (
    <div className="studio-mixcloud-box">
      <div className="studio-text-strong-sm studio-mb-sm">Spotify artist profile</div>
      <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
        Link your Spotify artist page so &ldquo;Your tracks&rdquo; auto-loads when adding tracks to
        a collection — no need to paste your artist URL every time. Spotify doesn&apos;t allow audio
        downloads, so tracks import as embeds (Spotify player, not Tahti FLAC), same as any other
        Spotify import on Tahti.
      </p>

      {profile ? (
        <div className="studio-row">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
            />
          ) : null}
          <span className="studio-text-success">
            Linked{profile.name ? `: ${profile.name}` : ''}
          </span>
          <button type="button" onClick={unlink} disabled={isPending} className="studio-text-sm">
            {isPending ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <form
          className="spotify-import-modal__url-row"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <input
            type="text"
            className="studio-input"
            placeholder="https://open.spotify.com/artist/…"
            value={artistUrl}
            onChange={(e) => setArtistUrl(e.target.value)}
          />
          <Button type="submit" variant="primary" size="sm" disabled={isPending}>
            <ButtonIcon name="link" />
            {isPending ? 'Linking…' : 'Link'}
          </Button>
        </form>
      )}
      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </div>
  )
}
