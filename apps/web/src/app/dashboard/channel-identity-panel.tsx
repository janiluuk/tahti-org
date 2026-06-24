// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { ARCHIVE_GENRES } from '@tahti/shared'
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import { completeAvatarUpload, prepareAvatarUpload } from './channel-identity-actions'

const BIO_MAX = 280
const MAX_GENRES = 6
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp']
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  countryCode: string | null
  pronouns: string | null
  bio: string
  genres: string[]
}

interface Props {
  initial: ChannelIdentityDraft
  onDraftChange?: (draft: ChannelIdentityDraft) => void
}

export default function ChannelIdentityPanel({ initial, onDraftChange }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [countryCode, setCountryCode] = useState(initial.countryCode ?? '')
  const [pronouns, setPronouns] = useState(initial.pronouns ?? '')
  const [bio, setBio] = useState(initial.bio)
  const [genres, setGenres] = useState<string[]>(initial.genres)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    onDraftChange?.({
      displayName,
      avatarUrl: avatarUrl || null,
      countryCode: countryCode || null,
      pronouns: pronouns || null,
      bio,
      genres,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, avatarUrl, countryCode, pronouns, bio, genres])

  function onFile(file: File) {
    setAvatarError(null)
    const type = file.type || 'image/jpeg'
    if (!ALLOWED_AVATAR_MIME.includes(type)) {
      setAvatarError('Use JPEG, PNG, or WebP')
      return
    }
    setCropSrc(URL.createObjectURL(file))
  }

  function onLoadUrl() {
    const url = avatarUrlInput.trim()
    if (!url) return
    setAvatarError(null)
    setCropSrc(`${API_BASE}/api/me/profile/avatar/proxy?url=${encodeURIComponent(url)}`)
  }

  async function onCropped(blob: Blob) {
    setCropSrc(null)
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const prep = await prepareAvatarUpload({ filename: 'avatar.jpg', contentType: 'image/jpeg' })
      if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
        setAvatarError(prep.error ?? 'Prepare failed')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', 'image/jpeg')
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
        xhr.onerror = () => reject(new Error('Upload failed'))
        xhr.send(blob)
      })
      const done = await completeAvatarUpload(prep.uploadKey)
      if (done.error) {
        setAvatarError(done.error)
        return
      }
      setAvatarUrl(done.avatarUrl ?? '')
      setAvatarUrlInput('')
    } catch {
      setAvatarError('Upload failed')
    } finally {
      setAvatarBusy(false)
    }
  }

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre].slice(0, MAX_GENRES),
    )
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
          onChange={(e) => setDisplayName(e.target.value)}
          className="studio-input"
        />
      </div>

      <div className="studio-field--block">
        <span className="studio-label">Avatar</span>
        <div className="studio-row studio-row--wrap studio-gap-lg">
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" width={56} height={56} className="studio-artwork-preview" />
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={avatarBusy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
            className="studio-file-input"
          />
        </div>
        <div className="studio-row studio-row--wrap studio-gap-lg studio-mt-sm">
          <input
            type="url"
            placeholder="…or paste an image URL"
            value={avatarUrlInput}
            disabled={avatarBusy}
            onChange={(e) => setAvatarUrlInput(e.target.value)}
            className="studio-input studio-input--grow"
          />
          <button
            type="button"
            className="ui-btn ui-btn--sm ui-btn--ghost"
            disabled={avatarBusy || !avatarUrlInput.trim()}
            onClick={onLoadUrl}
          >
            Use URL
          </button>
        </div>
        {avatarBusy && <p className="studio-text-muted-sm studio-mt-sm">Uploading…</p>}
        {avatarError && (
          <p className="studio-notice studio-notice--error studio-mt-sm">{avatarError}</p>
        )}
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onCropped={(blob) => void onCropped(blob)}
        />
      )}

      <div className="studio-field--block">
        <label className="studio-label" htmlFor="identity-country">
          Location
        </label>
        <select
          id="identity-country"
          value={countryCode}
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
        <label className="studio-label" htmlFor="identity-pronouns">
          Pronouns
        </label>
        <input
          id="identity-pronouns"
          type="text"
          list="identity-pronouns-suggestions"
          placeholder="e.g. she/her"
          maxLength={40}
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
          className="studio-input"
        />
        <datalist id="identity-pronouns-suggestions">
          <option value="she/her" />
          <option value="he/him" />
          <option value="they/them" />
          <option value="she/they" />
          <option value="he/they" />
        </datalist>
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
                onChange={() => toggleGenre(genre)}
              />
              <span>{genre}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  )
}
