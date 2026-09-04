// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  SOUND_GENRES,
  AVATAR_THEME_PRESETS,
  avatarThemeCss,
  randomAvatarTheme,
  type AvatarTheme,
  type LogoPlacement,
  LOGO_PLACEMENT_LABELS,
  LOGO_PLACEMENTS,
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
import { ButtonIcon, brandTokens } from '@tahti/ui'

const MAX_GENRES = 6
const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_LOGO_MIME = ['image/png', 'image/webp']
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const POSTER_SIZE = 512
const DEFAULT_AVATAR_COLOR = brandTokens.color.accent.cyan

export type ChannelIdentityDraft = {
  displayName: string
  avatarUrl: string | null
  avatarPosterUrl: string | null
  avatarTheme: AvatarTheme | null
  logoUrl: string | null
  logoPlacement: LogoPlacement | null
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
  const [dragOver, setDragOver] = useState(false)
  const [logoDragOver, setLogoDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

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
  const swatches = AVATAR_THEME_PRESETS.filter((p) => p.kind === 'gradient').slice(0, 8)

  return (
    <>
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

      <div className="studio-field--block">
        <span className="studio-label">Avatar</span>
        <div className="studio-avatar-picker">
          <div
            className={`studio-avatar-picker__drop${dragOver ? ' studio-avatar-picker__drop--drag' : ''}${avatarBusy ? ' studio-avatar-picker__drop--busy' : ''}`}
            style={
              {
                ['--avatar-pick-color' as string]: avatarColor,
                ...(themeCss && !previewSrc ? { background: themeCss } : {}),
              } as CSSProperties
            }
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
            {logoUrl && (logoPlacement === 'AVATAR' || logoPlacement === 'BOTH') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="studio-avatar-picker__logo" />
            ) : null}
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
            {!previewSrc && (
              <label
                className="studio-avatar-picker__color"
                title="Solid color avatar"
                aria-label="Solid color avatar"
              >
                <input
                  type="color"
                  value={avatarColor}
                  disabled={avatarBusy}
                  onChange={(e) => onColorPick(e.target.value)}
                />
              </label>
            )}
            {!previewSrc && (
              <button
                type="button"
                className="studio-avatar-picker__url-btn"
                title="Shuffle gradient"
                aria-label="Shuffle gradient"
                disabled={avatarBusy}
                onClick={onShuffleTheme}
              >
                <ButtonIcon name="refresh" />
              </button>
            )}
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

        {!previewSrc ? (
          <div className="studio-avatar-theme-swatches" role="list" aria-label="Gradient presets">
            {swatches.map((preset) => {
              const css = avatarThemeCss(preset)
              const active = avatarTheme != null && avatarThemeCss(avatarTheme) === css
              return (
                <button
                  key={css}
                  type="button"
                  className={`studio-avatar-theme-swatch${active ? ' studio-avatar-theme-swatch--active' : ''}`}
                  style={{ background: css }}
                  title="Apply gradient"
                  aria-label="Apply gradient"
                  aria-pressed={active}
                  disabled={avatarBusy}
                  onClick={() => applyTheme(preset)}
                />
              )
            })}
          </div>
        ) : (
          <details className="studio-details-block studio-mt-sm">
            <summary className="studio-details-block__summary">
              Replace photo with a theme avatar
            </summary>
            <div className="studio-details-block__body">
              <div className="studio-avatar-picker__tools studio-mb-sm">
                <label
                  className="studio-avatar-picker__color"
                  title="Solid color avatar"
                  aria-label="Solid color avatar"
                >
                  <input
                    type="color"
                    value={avatarColor}
                    disabled={avatarBusy}
                    onChange={(e) => onColorPick(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="studio-avatar-picker__url-btn"
                  title="Shuffle gradient"
                  aria-label="Shuffle gradient"
                  disabled={avatarBusy}
                  onClick={onShuffleTheme}
                >
                  <ButtonIcon name="refresh" />
                </button>
              </div>
              <div
                className="studio-avatar-theme-swatches"
                role="list"
                aria-label="Gradient presets"
              >
                {swatches.map((preset) => {
                  const css = avatarThemeCss(preset)
                  const active = avatarTheme != null && avatarThemeCss(avatarTheme) === css
                  return (
                    <button
                      key={css}
                      type="button"
                      className={`studio-avatar-theme-swatch${active ? ' studio-avatar-theme-swatch--active' : ''}`}
                      style={{ background: css }}
                      title="Apply gradient"
                      aria-label="Apply gradient"
                      aria-pressed={active}
                      disabled={avatarBusy}
                      onClick={() => applyTheme(preset)}
                    />
                  )
                })}
              </div>
            </div>
          </details>
        )}

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
          Pick a solid color or gradient (defaults are harmonious pairs), or drop a photo / paste a
          URL. PNG keeps transparency. GIFs animate on hover.
        </p>
      </div>

      <div className="studio-field--block">
        <span className="studio-label">Logo</span>
        <div className="studio-logo-picker">
          <div
            className={`studio-logo-picker__drop${logoDragOver ? ' studio-logo-picker__drop--drag' : ''}`}
            onClick={() => !avatarBusy && logoInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              if (!avatarBusy) setLogoDragOver(true)
            }}
            onDragLeave={() => setLogoDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setLogoDragOver(false)
              if (avatarBusy) return
              const file = event.dataTransfer.files?.[0]
              if (file) onLogoFile(file)
            }}
            onKeyDown={(event) => {
              if (!avatarBusy && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault()
                logoInputRef.current?.click()
              }
            }}
            role="button"
            tabIndex={avatarBusy ? -1 : 0}
            aria-disabled={avatarBusy}
            aria-label="Drop a transparent PNG or WebP logo, or click to browse"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="studio-logo-picker__img" />
            ) : (
              <span className="studio-logo-picker__placeholder">
                <ButtonIcon name="import" />
                <strong>{logoDragOver ? 'Drop logo' : 'Drop logo or click'}</strong>
                <small>Transparent PNG or WebP</small>
              </span>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/webp"
              disabled={avatarBusy}
              className="studio-avatar-picker__file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onLogoFile(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="studio-logo-picker__meta">
            <div
              className="studio-logo-picker__placements"
              role="radiogroup"
              aria-label="Logo placement"
            >
              {LOGO_PLACEMENTS.map((placement) => (
                <label
                  key={placement}
                  className={`studio-logo-picker__place${logoPlacement === placement ? ' studio-logo-picker__place--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="logo-placement"
                    value={placement}
                    checked={logoPlacement === placement}
                    disabled={avatarBusy || !logoUrl}
                    onChange={() => setLogoPlacement(placement)}
                  />
                  {LOGO_PLACEMENT_LABELS[placement]}
                </label>
              ))}
            </div>
            {logoUrl ? (
              <button
                type="button"
                className="ui-btn ui-btn--sm ui-btn--ghost"
                disabled={avatarBusy}
                onClick={clearLogo}
              >
                Remove logo
              </button>
            ) : null}
          </div>
        </div>
        <p className="studio-help studio-mt-xs">
          Transparent PNG/WebP sits on top of your avatar, profile cover, or both.
        </p>
        {avatarError && (
          <p className="studio-notice studio-notice--error studio-mt-sm">{avatarError}</p>
        )}
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          outputMime={cropMime}
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
    </>
  )
}
