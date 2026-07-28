// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { ARCHIVE_GENRES } from '@tahti/shared'
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import { completeAvatarUpload, prepareAvatarUpload } from './channel-identity-actions'
import { Button } from '@tahti/ui'

const MAX_GENRES = 6
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const POSTER_SIZE = 512

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  avatarPosterUrl: string | null
  countryCode: string | null
  pronouns: string | null
  defaultLocation: string | null
  genres: string[]
}

/** Draws a GIF's first frame onto a canvas and exports it as a JPEG blob —
 * the static poster shown at rest, since cropping a GIF through the normal
 * pan/zoom tool would flatten its animation (same canvas limitation
 * AvatarCropModal already has for the non-GIF path). */
function extractPosterFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = POSTER_SIZE
      canvas.height = POSTER_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not create canvas context'))
      const scale = Math.max(POSTER_SIZE / img.naturalWidth, POSTER_SIZE / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.drawImage(img, (POSTER_SIZE - w) / 2, (POSTER_SIZE - h) / 2, w, h)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not export poster frame'))),
        'image/jpeg',
        0.92,
      )
    }
    img.onerror = () => reject(new Error('Could not load that GIF'))
    img.src = URL.createObjectURL(file)
  })
}

async function uploadBlob(
  blob: Blob,
  filename: string,
  contentType: string,
): Promise<{ uploadKey?: string; error?: string }> {
  const prep = await prepareAvatarUpload({ filename, contentType })
  if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
    return { error: prep.error ?? 'Prepare failed' }
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', prep.uploadUrl!)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(blob)
  })
  return { uploadKey: prep.uploadKey }
}

interface Props {
  initial: ChannelIdentityDraft
  onDraftChange?: (draft: ChannelIdentityDraft) => void
}

export default function ChannelIdentityPanel({ initial, onDraftChange }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [avatarPosterUrl, setAvatarPosterUrl] = useState(initial.avatarPosterUrl ?? '')
  const [countryCode, setCountryCode] = useState(initial.countryCode ?? '')
  const [pronouns, setPronouns] = useState(initial.pronouns ?? '')
  const [defaultLocation, setDefaultLocation] = useState(initial.defaultLocation ?? '')
  const [genres, setGenres] = useState<string[]>(initial.genres)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    onDraftChange?.({
      displayName,
      avatarUrl: avatarUrl || null,
      avatarPosterUrl: avatarPosterUrl || null,
      countryCode: countryCode || null,
      pronouns: pronouns || null,
      defaultLocation: defaultLocation || null,
      genres,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName, avatarUrl, avatarPosterUrl, countryCode, pronouns, defaultLocation, genres])

  async function onGifFile(file: File) {
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const poster = await extractPosterFrame(file)
      const posterUp = await uploadBlob(poster, 'avatar-poster.jpg', 'image/jpeg')
      if (posterUp.error || !posterUp.uploadKey) {
        setAvatarError(posterUp.error ?? 'Prepare failed')
        return
      }
      const gifUp = await uploadBlob(file, file.name || 'avatar.gif', 'image/gif')
      if (gifUp.error || !gifUp.uploadKey) {
        setAvatarError(gifUp.error ?? 'Upload failed')
        return
      }
      const done = await completeAvatarUpload(gifUp.uploadKey, posterUp.uploadKey)
      if (done.error) {
        setAvatarError(done.error)
        return
      }
      setAvatarUrl(done.avatarUrl ?? '')
      setAvatarPosterUrl(done.avatarPosterUrl ?? '')
      setAvatarUrlInput('')
    } catch {
      setAvatarError('Upload failed')
    } finally {
      setAvatarBusy(false)
    }
  }

  function onFile(file: File) {
    setAvatarError(null)
    const type = file.type || 'image/jpeg'
    if (!ALLOWED_AVATAR_MIME.includes(type)) {
      setAvatarError('Use JPEG, PNG, WebP, or GIF')
      return
    }
    // GIFs skip the pan/zoom crop tool entirely — cropping via canvas would
    // flatten the animation to a single frame, defeating the point.
    if (type === 'image/gif') {
      void onGifFile(file)
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
      // No posterUploadKey — a freshly cropped static avatar clears any
      // stale poster left over from a previous animated GIF.
      const done = await completeAvatarUpload(prep.uploadKey)
      if (done.error) {
        setAvatarError(done.error)
        return
      }
      setAvatarUrl(done.avatarUrl ?? '')
      setAvatarPosterUrl('')
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
          Artist name
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={avatarBusy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
            className="studio-file-input"
          />
        </div>
        <p className="studio-help studio-mt-xs">
          GIF avatars play on hover on your profile page — otherwise they show a still frame.
        </p>
        <div className="studio-row studio-row--wrap studio-gap-lg studio-mt-sm">
          <input
            type="url"
            placeholder="…or paste an image URL"
            value={avatarUrlInput}
            disabled={avatarBusy}
            onChange={(e) => setAvatarUrlInput(e.target.value)}
            className="studio-input studio-input--grow"
          />
          <Button
            disabled={avatarBusy || !avatarUrlInput.trim()}
            onClick={onLoadUrl}
            variant="ghost"
            size="sm"
          >
            Use URL
          </Button>
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
        <label className="studio-label" htmlFor="identity-default-location">
          Default location
        </label>
        <input
          id="identity-default-location"
          type="text"
          placeholder="e.g. Helsinki, Finland"
          maxLength={120}
          value={defaultLocation}
          onChange={(e) => setDefaultLocation(e.target.value)}
          className="studio-input"
        />
        <p className="studio-help studio-mt-xs">
          Prefills the city/country when you tag a venue on a live set.
        </p>
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
