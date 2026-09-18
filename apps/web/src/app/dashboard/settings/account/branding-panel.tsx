'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useRef, useState } from 'react'
import { AvatarTile, Button, StudioCollapse, brandTokens } from '@tahti/ui'
import { LOGO_PLACEMENTS, LOGO_PLACEMENT_LABELS, type LogoPlacement } from '@tahti/shared'
import { ImageCropModal } from '@/components/image-crop-modal'
import {
  completeAvatarUpload,
  completeBackdropUpload,
  completeLogoUpload,
  prepareAvatarUpload,
  prepareBackdropUpload,
  prepareLogoUpload,
  updateChannelProfile,
} from '../../channel-identity-actions'
import { uploadBlob } from '../../channel-identity-utils'

const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_LOGO_MIME = ['image/png', 'image/webp']
const DEFAULT_NAMEPLATE_COLOR = brandTokens.color.accent.purple

interface Props {
  displayName: string
  username: string
  initialAvatarUrl: string | null
  initialAvatarPosterUrl: string | null
  initialBackdropUrl: string | null
  initialNameplateText: string | null
  initialNameplateColor: string | null
  initialLogoUrl: string | null
  initialLogoPlacement: LogoPlacement | null
}

/** Settings → Account → Branding: avatar + backdrop (both cropped with the
 * shared ImageCropModal), the nameplate pill shown next to the display name,
 * and the transparent-background artist logo overlaid on the avatar/cover —
 * mirroring the reference "Nameplate / Avatar / Banner" layout. */
export function BrandingPanel({
  displayName,
  username,
  initialAvatarUrl,
  initialAvatarPosterUrl,
  initialBackdropUrl,
  initialNameplateText,
  initialNameplateColor,
  initialLogoUrl,
  initialLogoPlacement,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? '')
  const [avatarPosterUrl, setAvatarPosterUrl] = useState(initialAvatarPosterUrl ?? '')
  const [backdropUrl, setBackdropUrl] = useState(initialBackdropUrl ?? '')
  const [nameplateText, setNameplateText] = useState(initialNameplateText ?? '')
  const [nameplateColor, setNameplateColor] = useState(
    initialNameplateColor ?? DEFAULT_NAMEPLATE_COLOR,
  )
  const [savedNameplate, setSavedNameplate] = useState({
    text: initialNameplateText ?? '',
    color: initialNameplateColor ?? DEFAULT_NAMEPLATE_COLOR,
  })
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? '')
  const [logoPlacement, setLogoPlacement] = useState<LogoPlacement | null>(initialLogoPlacement)
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false)
  const [logoSaving, setLogoSaving] = useState(false)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropKind, setCropKind] = useState<'avatar' | 'backdrop' | 'logo'>('avatar')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameplateSaving, setNameplateSaving] = useState(false)
  const [nameplateSaved, setNameplateSaved] = useState(false)

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const backdropInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  function pickFile(kind: 'avatar' | 'backdrop' | 'logo', file: File | undefined) {
    if (!file) return
    if (kind === 'logo') {
      if (!ALLOWED_LOGO_MIME.includes(file.type)) {
        setError('Logo must be PNG or WebP (with transparency)')
        return
      }
    } else if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
      setError('Image must be JPEG, PNG, or WebP')
      return
    }
    setError(null)
    setCropKind(kind)
    setCropSrc(URL.createObjectURL(file))
  }

  async function onCropped(blob: Blob) {
    setCropSrc(null)
    setBusy(true)
    setError(null)
    try {
      if (cropKind === 'avatar') {
        const up = await uploadBlob(blob, 'avatar.jpg', 'image/jpeg', prepareAvatarUpload)
        if (up.error || !up.uploadKey) {
          setError(up.error ?? 'Upload failed')
          return
        }
        const done = await completeAvatarUpload(up.uploadKey)
        if (done.error) {
          setError(done.error)
          return
        }
        setAvatarUrl(done.avatarUrl ?? '')
        setAvatarPosterUrl(done.avatarPosterUrl ?? '')
      } else if (cropKind === 'backdrop') {
        const up = await uploadBlob(blob, 'backdrop.jpg', 'image/jpeg', prepareBackdropUpload)
        if (up.error || !up.uploadKey) {
          setError(up.error ?? 'Upload failed')
          return
        }
        const done = await completeBackdropUpload(up.uploadKey)
        if (done.error) {
          setError(done.error)
          return
        }
        setBackdropUrl(done.backdropUrl ?? '')
      } else {
        const up = await uploadBlob(blob, 'logo.png', 'image/png', prepareLogoUpload)
        if (up.error || !up.uploadKey) {
          setError(up.error ?? 'Upload failed')
          return
        }
        const done = await completeLogoUpload(up.uploadKey)
        if (done.error) {
          setError(done.error)
          return
        }
        setLogoUrl(done.logoUrl ?? '')
        setConfirmRemoveLogo(false)
        if (!logoPlacement) setLogoPlacement('AVATAR')
      }
    } finally {
      setBusy(false)
    }
  }

  async function changeLogoPlacement(placement: LogoPlacement) {
    const previous = logoPlacement
    setLogoPlacement(placement)
    setLogoSaving(true)
    setError(null)
    try {
      const { error: err } = await updateChannelProfile({ logoPlacement: placement })
      if (err) {
        setError(err)
        setLogoPlacement(previous)
      }
    } finally {
      setLogoSaving(false)
    }
  }

  async function clearLogo() {
    setLogoSaving(true)
    setError(null)
    try {
      const { error: err } = await updateChannelProfile({ logoUrl: null, logoPlacement: null })
      if (err) {
        setError(err)
        return
      }
      setLogoUrl('')
      setLogoPlacement(null)
      setConfirmRemoveLogo(false)
    } finally {
      setLogoSaving(false)
    }
  }

  async function saveNameplate() {
    setNameplateSaving(true)
    setNameplateSaved(false)
    setError(null)
    try {
      const trimmed = nameplateText.trim()
      const { error: err } = await updateChannelProfile({
        nameplateText: trimmed || null,
        nameplateColor: trimmed ? nameplateColor : null,
      })
      if (err) {
        setError(err)
        return
      }
      setSavedNameplate({ text: trimmed, color: nameplateColor })
      setNameplateSaved(true)
    } finally {
      setNameplateSaving(false)
    }
  }

  const nameplateDirty =
    nameplateText.trim() !== savedNameplate.text || nameplateColor !== savedNameplate.color

  return (
    <StudioCollapse title="Branding" defaultOpen>
      <div className="branding-panel">
        {error && <p className="studio-notice studio-notice--error">{error}</p>}

        {cropSrc && (
          <ImageCropModal
            imageSrc={cropSrc}
            outputMime={cropKind === 'logo' ? 'image/png' : 'image/jpeg'}
            aspectRatio={cropKind === 'backdrop' ? 3 : 1}
            shape={cropKind === 'backdrop' ? 'rect' : 'circle'}
            title={
              cropKind === 'backdrop'
                ? 'Position your backdrop'
                : cropKind === 'logo'
                  ? 'Position your logo'
                  : 'Position your avatar'
            }
            confirmLabel={
              cropKind === 'backdrop'
                ? 'Use this backdrop'
                : cropKind === 'logo'
                  ? 'Use this logo'
                  : 'Use this avatar'
            }
            onCancel={() => setCropSrc(null)}
            onCropped={(blob) => void onCropped(blob)}
          />
        )}

        {/* Live preview — mirrors the reference "backdrop + avatar + nameplate" card. */}
        <div
          className="branding-panel__preview"
          style={backdropUrl ? { backgroundImage: `url(${backdropUrl})` } : undefined}
        >
          <AvatarTile
            size="lg"
            name={displayName}
            src={avatarUrl || null}
            posterUrl={avatarPosterUrl || null}
            bordered
            className="branding-panel__preview-avatar"
          />
          <div className="branding-panel__preview-identity">
            <span className="branding-panel__preview-name">
              {displayName}
              {nameplateText.trim() && (
                <span
                  className="branding-panel__nameplate"
                  style={{ backgroundColor: nameplateColor }}
                >
                  {nameplateText.trim()}
                </span>
              )}
            </span>
            <span className="branding-panel__preview-handle">@{username}</span>
          </div>
        </div>

        <div className="branding-panel__row">
          <div className="studio-field--block">
            <span className="studio-label">Avatar</span>
            <input
              ref={avatarInputRef}
              type="file"
              accept={ALLOWED_IMAGE_MIME.join(',')}
              hidden
              onChange={(e) => pickFile('avatar', e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => avatarInputRef.current?.click()}
            >
              {avatarUrl ? 'Change avatar' : 'Upload avatar'}
            </Button>
          </div>

          <div className="studio-field--block">
            <span className="studio-label">Backdrop</span>
            <input
              ref={backdropInputRef}
              type="file"
              accept={ALLOWED_IMAGE_MIME.join(',')}
              hidden
              onChange={(e) => pickFile('backdrop', e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => backdropInputRef.current?.click()}
            >
              {backdropUrl ? 'Change backdrop' : 'Upload backdrop'}
            </Button>
          </div>
        </div>

        <div className="studio-field--block">
          <span className="studio-label">Artist logo</span>
          <div className="branding-panel__logo-row">
            <div className="branding-panel__logo-thumb">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="branding-panel__logo-thumb-img" />
              ) : (
                <span className="branding-panel__logo-thumb-placeholder">No logo</span>
              )}
            </div>
            <div className="branding-panel__logo-controls">
              <input
                ref={logoInputRef}
                type="file"
                accept={ALLOWED_LOGO_MIME.join(',')}
                hidden
                onChange={(e) => pickFile('logo', e.target.files?.[0])}
              />
              <div className="branding-panel__row">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoUrl ? 'Change logo' : 'Upload logo'}
                </Button>
                {logoUrl &&
                  (confirmRemoveLogo ? (
                    <>
                      <Button
                        variant="danger"
                        disabled={logoSaving}
                        onClick={() => void clearLogo()}
                      >
                        Confirm remove
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmRemoveLogo(false)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={logoSaving}
                      onClick={() => setConfirmRemoveLogo(true)}
                    >
                      Remove logo
                    </Button>
                  ))}
              </div>
              {logoUrl && (
                <div
                  className="branding-panel__logo-placements"
                  role="radiogroup"
                  aria-label="Logo placement"
                >
                  {LOGO_PLACEMENTS.map((placement) => (
                    <label
                      key={placement}
                      className={`branding-panel__logo-place${logoPlacement === placement ? ' branding-panel__logo-place--active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="branding-logo-placement"
                        value={placement}
                        checked={logoPlacement === placement}
                        disabled={logoSaving}
                        onChange={() => void changeLogoPlacement(placement)}
                      />
                      {LOGO_PLACEMENT_LABELS[placement]}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="studio-help studio-mt-xs">
            Transparent PNG or WebP — sits on top of your avatar, profile cover, or both.
          </p>
        </div>

        <div className="studio-field--block">
          <label className="studio-label" htmlFor="branding-nameplate-text">
            Nameplate
          </label>
          <div className="branding-panel__nameplate-row">
            <input
              id="branding-nameplate-text"
              type="color"
              value={nameplateColor}
              onChange={(e) => {
                setNameplateColor(e.target.value)
                setNameplateSaved(false)
              }}
              aria-label="Nameplate color"
              className="branding-panel__color-input"
            />
            <input
              type="text"
              value={nameplateText}
              maxLength={40}
              placeholder="e.g. DJ · Producer"
              onChange={(e) => {
                setNameplateText(e.target.value)
                setNameplateSaved(false)
              }}
              className="studio-input"
            />
            <Button
              variant="primary"
              disabled={!nameplateDirty || nameplateSaving}
              onClick={() => void saveNameplate()}
            >
              {nameplateSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          {nameplateSaved && !nameplateDirty && <p className="studio-text-muted-sm">Saved.</p>}
        </div>
      </div>
    </StudioCollapse>
  )
}
