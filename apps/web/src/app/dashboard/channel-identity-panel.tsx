// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ARCHIVE_GENRES } from '@tahti/shared'
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { updateChannelProfile } from './channel-identity-actions'

const BIO_MAX = 280
const MAX_GENRES = 6

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  countryCode: string | null
  bio: string
  genres: string[]
}

interface Props {
  initial: ChannelIdentityDraft
  onDraftChange?: (draft: ChannelIdentityDraft) => void
}

export default function ChannelIdentityPanel({ initial, onDraftChange }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [countryCode, setCountryCode] = useState(initial.countryCode ?? '')
  const [bio, setBio] = useState(initial.bio)
  const [genres, setGenres] = useState<string[]>(initial.genres)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    onDraftChange?.({
      displayName,
      avatarUrl: avatarUrl || null,
      countryCode: countryCode || null,
      bio,
      genres,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, avatarUrl, countryCode, bio, genres])

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre].slice(0, MAX_GENRES),
    )
  }

  function save() {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await updateChannelProfile({
        displayName,
        bio,
        avatarUrl,
        countryCode: countryCode || null,
        socialLinks: { genres: genres.join(', ') },
      })
      if (res.error) {
        setError(res.error)
        return
      }
      setMessage('Identity saved.')
      router.refresh()
    })
  }

  return (
    <>
      <div className="studio-field--block">
        <label className="studio-label" htmlFor="identity-display-name">
          Display name
        </label>
        <input
          id="identity-display-name"
          type="text"
          maxLength={100}
          value={displayName}
          disabled={isPending}
          onChange={(e) => setDisplayName(e.target.value)}
          className="studio-input"
        />
      </div>

      <div className="studio-field--block">
        <label className="studio-label" htmlFor="identity-avatar">
          Avatar image URL
        </label>
        <input
          id="identity-avatar"
          type="url"
          placeholder="https://…"
          value={avatarUrl}
          disabled={isPending}
          onChange={(e) => setAvatarUrl(e.target.value)}
          className="studio-input"
        />
      </div>

      <div className="studio-field--block">
        <label className="studio-label" htmlFor="identity-country">
          Location
        </label>
        <select
          id="identity-country"
          value={countryCode}
          disabled={isPending}
          onChange={(e) => setCountryCode(e.target.value)}
          className="studio-input"
        >
          <option value="">Not set</option>
          {COUNTRY_OPTIONS.map(({ code, label }) => (
            <option key={code} value={code}>
              {flagEmoji(code)} {label}
            </option>
          ))}
        </select>
      </div>

      <div className="studio-field--block">
        <label className="studio-label" htmlFor="identity-bio">
          Bio
          <span className="studio-text-muted-sm">
            {' '}
            · {bio.length}/{BIO_MAX} chars
          </span>
        </label>
        <textarea
          id="identity-bio"
          rows={4}
          maxLength={BIO_MAX}
          value={bio}
          disabled={isPending}
          onChange={(e) => setBio(e.target.value)}
          className="studio-input"
          placeholder="Tell listeners about your sound, shows, and releases…"
        />
      </div>

      <div className="studio-field--block">
        <span className="studio-label">Genre tags (up to {MAX_GENRES})</span>
        <div className="signup-genre-grid">
          {ARCHIVE_GENRES.map((genre) => (
            <label key={genre} className="signup-genre-chip">
              <input
                type="checkbox"
                checked={genres.includes(genre)}
                disabled={isPending}
                onChange={() => toggleGenre(genre)}
              />
              <span>{genre}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}

      <div className="studio-actions">
        <button
          type="button"
          className="ui-btn ui-btn--primary"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? 'Saving…' : 'Save identity'}
        </button>
      </div>
    </>
  )
}
