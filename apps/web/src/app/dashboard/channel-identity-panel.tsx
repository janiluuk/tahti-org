// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState } from 'react'
import { ARCHIVE_GENRES } from '@tahti/shared'
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import {
  avatarFromUrl,
  completeAvatarUpload,
  prepareAvatarUpload,
} from './channel-identity-actions'
import { ButtonIcon, brandTokens } from '@tahti/ui'

const MAX_GENRES = 6
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const POSTER_SIZE = 512
const DEFAULT_AVATAR_COLOR = brandTokens.color.accent.cyan

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  avatarPosterUrl: string | null
  countryCode: string | null
  pronouns: string | null
  defaultLocation: string | null
  genres: string[]
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
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

function solidColorAvatar(hex: string, initials: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = POSTER_SIZE
    canvas.height = POSTER_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('Could not create canvas context'))
    ctx.fillStyle = hex
    ctx.fillRect(0, 0, POSTER_SIZE, POSTER_SIZE)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = `600 ${Math.round(POSTER_SIZE * 0.34)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials.slice(0, 2), POSTER_SIZE / 2, POSTER_SIZE / 2 + 8)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not export color avatar'))),
      'image/jpeg',
      0.92,
    )
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
  const [avatarColor, setAvatarColor] = useState(DEFAULT_AVATAR_COLOR)
  const [urlMode, setUrlMode] = useState(false)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      setUrlMode(false)
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

  async function onColorPick(hex: string) {
    setAvatarColor(hex)
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      const blob = await solidColorAvatar(hex, initialsFromName(displayName))
      const up = await uploadBlob(blob, 'avatar-color.jpg', 'image/jpeg')
      if (up.error || !up.uploadKey) {
        setAvatarError(up.error ?? 'Prepare failed')
        return
      }
      const done = await completeAvatarUpload(up.uploadKey)
      if (done.error) {
        setAvatarError(done.error)
        return
      }
      setAvatarUrl(done.avatarUrl ?? '')
      setAvatarPosterUrl('')
    } catch {
      setAvatarError('Could not apply that color')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function onLoadUrl() {
    const url = avatarUrlInput.trim()
    if (!url) return
    setAvatarError(null)
    // Prefer crop for still images via same-origin proxy; GIFs go straight to rehost.
    if (/\.gif(\?|$)/i.test(url)) {
      setAvatarBusy(true)
      try {
        const done = await avatarFromUrl(url)
        if (done.error) {
          setAvatarError(done.error)
          return
        }
        setAvatarUrl(done.avatarUrl ?? '')
        setAvatarPosterUrl('')
        setAvatarUrlInput('')
        setUrlMode(false)
      } catch {
        setAvatarError('Could not fetch that URL')
      } finally {
        setAvatarBusy(false)
      }
      return
    }
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
      setUrlMode(false)
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

  const previewSrc = avatarPosterUrl || avatarUrl

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
        <div className="studio-avatar-picker">
          <div
            className={`studio-avatar-picker__drop${dragOver ? ' studio-avatar-picker__drop--drag' : ''}${avatarBusy ? ' studio-avatar-picker__drop--busy' : ''}`}
            style={{ ['--avatar-pick-color' as string]: avatarColor }}
            onDragOver={(e) => {
              e.preventDefault()
              if (!avatarBusy) setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              if (avatarBusy) return
              const f = e.dataTransfer.files?.[0]
              if (f) onFile(f)
            }}
            onClick={() => !avatarBusy && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload avatar — drop an image or click to browse"
            onKeyDown={(e) => {
              if (!avatarBusy && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
          >
            {previewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewSrc} alt="" className="studio-avatar-picker__img" />
            ) : (
              <span className="studio-avatar-picker__initials" aria-hidden>
                {initialsFromName(displayName)}
              </span>
            )}
            <span className="studio-avatar-picker__hint">
              {avatarBusy ? '…' : dragOver ? 'Drop' : 'Drop / click'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={avatarBusy}
              className="studio-avatar-picker__file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
          </div>

          <div className="studio-avatar-picker__tools">
            <label
              className="studio-avatar-picker__color"
              title="Pick a color avatar"
              aria-label="Pick a color avatar"
            >
              <input
                type="color"
                value={avatarColor}
                disabled={avatarBusy}
                onChange={(e) => void onColorPick(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`studio-avatar-picker__url-btn${urlMode ? ' studio-avatar-picker__url-btn--active' : ''}`}
              title="Use image URL"
              aria-label="Use image URL"
              aria-pressed={urlMode}
              disabled={avatarBusy}
              onClick={() => {
                setUrlMode((v) => !v)
                setAvatarError(null)
              }}
            >
              <ButtonIcon name="link" />
            </button>
          </div>
        </div>

        {urlMode && (
          <div className="studio-avatar-picker__url-row">
            <input
              type="url"
              placeholder="https://… image URL"
              value={avatarUrlInput}
              disabled={avatarBusy}
              onChange={(e) => setAvatarUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onLoadUrl()
              }}
              className="studio-input studio-input--grow"
            />
            <button
              type="button"
              className="ui-btn ui-btn--sm ui-btn--primary"
              disabled={avatarBusy || !avatarUrlInput.trim()}
              onClick={() => void onLoadUrl()}
            >
              {avatarBusy ? '…' : 'Fetch'}
            </button>
          </div>
        )}

        <p className="studio-help studio-mt-xs">
          Color fills a solid avatar, or drop a photo / paste a URL. GIFs animate on hover.
        </p>
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
