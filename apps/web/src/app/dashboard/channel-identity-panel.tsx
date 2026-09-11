'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { resolveClientApiUrl } from '@/lib/api-url'

import { useEffect, useState } from 'react'
import {
  SOUND_GENRES,
  avatarThemeCss,
  randomAvatarTheme,
  type AvatarTheme,
  type LogoPlacement,
} from '@tahti/shared'
import { COUNTRY_OPTIONS } from '@/lib/country-options'
import { flagEmoji } from '@/lib/flag-emoji'
import { AvatarCropModal } from '@/components/avatar-crop-modal'
import {
  avatarFromUrl,
  completeAvatarUpload,
  completeLogoUpload,
  prepareAvatarUpload,
  prepareLogoUpload,
} from './channel-identity-actions'
import { brandTokens, StudioCollapse } from '@tahti/ui'
import { ChannelIdentityMediaSection } from './channel-identity-media-section'
import { extractPosterFrame, uploadBlob, type ChannelIdentityDraft } from './channel-identity-utils'

export type { ChannelIdentityDraft } from './channel-identity-utils'

const MAX_GENRES = 6
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_LOGO_MIME = ['image/png', 'image/webp']
const API_BASE = resolveClientApiUrl()
const DEFAULT_AVATAR_COLOR = brandTokens.color.accent.cyan

interface Props {
  initial: ChannelIdentityDraft
  onDraftChange?: (draft: ChannelIdentityDraft) => void
  /** Switches the name field's label to "Collective name" — defaults to the
   * solo-artist label when the caller doesn't pass this (e.g. older callers
   * that predate the act-type selector). */
  artistKind?: 'SINGLE' | 'COLLECTIVE'
}

export default function ChannelIdentityPanel({ initial, onDraftChange, artistKind }: Props) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? '')
  const [avatarPosterUrl, setAvatarPosterUrl] = useState(initial.avatarPosterUrl ?? '')
  const [avatarTheme, setAvatarTheme] = useState<AvatarTheme | null>(initial.avatarTheme)
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '')
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement | null>(
    initial.logoPlacement ?? (initial.logoUrl ? 'AVATAR' : null),
  )
  const [countryCode, setCountryCode] = useState(initial.countryCode ?? '')
  const [pronouns, setPronouns] = useState(initial.pronouns ?? '')
  const [defaultLocation, setDefaultLocation] = useState(initial.defaultLocation ?? '')
  const [genres, setGenres] = useState<string[]>(initial.genres)
  const [avatarColor, setAvatarColor] = useState<string>(
    initial.avatarTheme?.colors[0] ?? DEFAULT_AVATAR_COLOR,
  )
  const [urlMode, setUrlMode] = useState(false)
  const [avatarUrlInput, setAvatarUrlInput] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropMime, setCropMime] = useState<'image/jpeg' | 'image/png'>('image/jpeg')
  const [cropKind, setCropKind] = useState<'avatar' | 'logo'>('avatar')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false)

  useEffect(() => {
    onDraftChange?.({
      displayName,
      avatarUrl: avatarUrl || null,
      avatarPosterUrl: avatarPosterUrl || null,
      avatarTheme,
      logoUrl: logoUrl || null,
      logoPlacement: logoUrl ? (logoPlacement ?? 'AVATAR') : null,
      countryCode: countryCode || null,
      pronouns: pronouns || null,
      defaultLocation: defaultLocation || null,
      genres,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayName,
    avatarUrl,
    avatarPosterUrl,
    avatarTheme,
    logoUrl,
    logoPlacement,
    countryCode,
    pronouns,
    defaultLocation,
    genres,
  ])

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
    setCropKind('avatar')
    setCropMime(type === 'image/png' || type === 'image/webp' ? 'image/png' : 'image/jpeg')
    setCropSrc(URL.createObjectURL(file))
  }

  function onLogoFile(file: File) {
    setAvatarError(null)
    const type = file.type || ''
    if (!ALLOWED_LOGO_MIME.includes(type)) {
      setAvatarError('Logo must be PNG or WebP (with transparency)')
      return
    }
    setCropKind('logo')
    setCropMime('image/png')
    setCropSrc(URL.createObjectURL(file))
  }

  function applyTheme(theme: AvatarTheme) {
    setAvatarTheme(theme)
    setAvatarColor(theme.colors[0] ?? DEFAULT_AVATAR_COLOR)
    // Theme fill replaces a baked photo avatar so the CSS theme shows through.
    setAvatarUrl('')
    setAvatarPosterUrl('')
  }

  function onColorPick(hex: string) {
    setAvatarColor(hex)
    applyTheme({ kind: 'solid', colors: [hex] })
  }

  function onShuffleTheme() {
    applyTheme(randomAvatarTheme(avatarTheme))
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
    setCropKind('avatar')
    setCropMime(/\.(png|webp)(\?|$)/i.test(url) ? 'image/png' : 'image/jpeg')
    setCropSrc(`${API_BASE}/api/me/profile/avatar/proxy?url=${encodeURIComponent(url)}`)
  }

  async function onCropped(blob: Blob) {
    setCropSrc(null)
    setAvatarBusy(true)
    setAvatarError(null)
    try {
      if (cropKind === 'logo') {
        const prep = await prepareLogoUpload({ filename: 'logo.png', contentType: 'image/png' })
        if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
          setAvatarError(prep.error ?? 'Prepare failed')
          return
        }
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', prep.uploadUrl!)
          xhr.setRequestHeader('Content-Type', 'image/png')
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject())
          xhr.onerror = () => reject(new Error('Upload failed'))
          xhr.send(blob)
        })
        const done = await completeLogoUpload(prep.uploadKey)
        if (done.error) {
          setAvatarError(done.error)
          return
        }
        setLogoUrl(done.logoUrl ?? '')
        if (!logoPlacement) setLogoPlacement('AVATAR')
        return
      }

      const contentType = cropMime
      const filename = contentType === 'image/png' ? 'avatar.png' : 'avatar.jpg'
      const prep = await prepareAvatarUpload({ filename, contentType })
      if (prep.error || !prep.uploadUrl || !prep.uploadKey) {
        setAvatarError(prep.error ?? 'Prepare failed')
        return
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', prep.uploadUrl!)
        xhr.setRequestHeader('Content-Type', contentType)
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

  function clearLogo() {
    setLogoUrl('')
    setLogoPlacement(null)
    setConfirmRemoveLogo(false)
  }

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre].slice(0, MAX_GENRES),
    )
  }

  const previewSrc = avatarPosterUrl || avatarUrl
  const themeCss = avatarTheme ? avatarThemeCss(avatarTheme) : undefined

  return (
    <>
      <StudioCollapse title="Essentials" defaultOpen>
        <div className="studio-field--block">
          <label className="studio-label" htmlFor="identity-display-name">
            {artistKind === 'COLLECTIVE' ? 'Collective name' : 'Artist name'}
          </label>
          <input
            id="identity-display-name"
            type="text"
            maxLength={100}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="studio-input"
            autoComplete="name"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore="true"
            data-form-type="other"
          />
        </div>
      </StudioCollapse>

      <ChannelIdentityMediaSection
        displayName={displayName}
        previewSrc={previewSrc}
        themeCss={themeCss}
        avatarColor={avatarColor}
        avatarTheme={avatarTheme}
        avatarBusy={avatarBusy}
        avatarError={avatarError}
        urlMode={urlMode}
        avatarUrlInput={avatarUrlInput}
        logoUrl={logoUrl}
        logoPlacement={logoPlacement}
        confirmRemoveLogo={confirmRemoveLogo}
        onFile={onFile}
        onLogoFile={onLogoFile}
        onColorPick={onColorPick}
        onShuffleTheme={onShuffleTheme}
        onLoadUrl={onLoadUrl}
        applyTheme={applyTheme}
        clearLogo={clearLogo}
        onToggleUrlMode={() => {
          setUrlMode((v) => !v)
          setAvatarError(null)
        }}
        setAvatarUrlInput={setAvatarUrlInput}
        setLogoPlacement={setLogoPlacement}
        setConfirmRemoveLogo={setConfirmRemoveLogo}
      />

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          outputMime={cropMime}
          onCancel={() => setCropSrc(null)}
          onCropped={(blob) => void onCropped(blob)}
        />
      )}

      <StudioCollapse title="Profile" defaultOpen>
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
      </StudioCollapse>

      <StudioCollapse title="Genres" hint={`${genres.length} selected`} defaultOpen={false}>
        <div className="studio-field--block">
          <span className="studio-label">Genre tags (up to {MAX_GENRES})</span>
          <div className="signup-genre-grid">
            {SOUND_GENRES.map((genre) => (
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
      </StudioCollapse>
    </>
  )
}
