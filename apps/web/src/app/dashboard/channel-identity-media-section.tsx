'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { type CSSProperties } from 'react'
import {
  AVATAR_THEME_PRESETS,
  avatarThemeCss,
  type AvatarTheme,
  type LogoPlacement,
  LOGO_PLACEMENT_LABELS,
  LOGO_PLACEMENTS,
} from '@tahti/shared'
import { ButtonIcon, FileDropzone, StudioCollapse } from '@tahti/ui'
import { initialsFromName } from './channel-identity-utils'

const swatches = AVATAR_THEME_PRESETS.filter((p) => p.kind === 'gradient').slice(0, 8)

export function ChannelIdentityMediaSection({
  displayName,
  previewSrc,
  themeCss,
  avatarColor,
  avatarTheme,
  avatarBusy,
  avatarError,
  urlMode,
  avatarUrlInput,
  logoUrl,
  logoPlacement,
  confirmRemoveLogo,
  onFile,
  onLogoFile,
  onColorPick,
  onShuffleTheme,
  onLoadUrl,
  applyTheme,
  clearLogo,
  onToggleUrlMode,
  setAvatarUrlInput,
  setLogoPlacement,
  setConfirmRemoveLogo,
}: {
  displayName: string
  previewSrc: string
  themeCss: string | undefined
  avatarColor: string
  avatarTheme: AvatarTheme | null
  avatarBusy: boolean
  avatarError: string | null
  urlMode: boolean
  avatarUrlInput: string
  logoUrl: string
  logoPlacement: LogoPlacement | null
  confirmRemoveLogo: boolean
  onFile: (file: File) => void
  onLogoFile: (file: File) => void
  onColorPick: (hex: string) => void
  onShuffleTheme: () => void
  onLoadUrl: () => void
  applyTheme: (theme: AvatarTheme) => void
  clearLogo: () => void
  onToggleUrlMode: () => void
  setAvatarUrlInput: (value: string) => void
  setLogoPlacement: (placement: LogoPlacement) => void
  setConfirmRemoveLogo: (value: boolean) => void
}) {
  return (
    <StudioCollapse title="Media" defaultOpen>
      <div className="studio-field--block">
        <span className="studio-label">Avatar</span>
        <div className="studio-avatar-picker">
          <FileDropzone
            bare
            label="Upload avatar — drop an image or click to browse"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={avatarBusy}
            className={`studio-avatar-picker__drop${avatarBusy ? ' studio-avatar-picker__drop--busy' : ''}`}
            style={
              {
                ['--avatar-pick-color' as string]: avatarColor,
                ...(themeCss && !previewSrc ? { background: themeCss } : {}),
              } as CSSProperties
            }
            onFiles={(files) => {
              const f = files[0]
              if (f) onFile(f)
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
            <span className="studio-avatar-picker__hint">{avatarBusy ? '…' : 'Drop / click'}</span>
          </FileDropzone>

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
              onClick={onToggleUrlMode}
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
          <FileDropzone
            bare
            label="Drop a transparent PNG or WebP logo, or click to browse"
            accept="image/png,image/webp"
            disabled={avatarBusy}
            className="studio-logo-picker__drop"
            onFiles={(files) => {
              const file = files[0]
              if (file) onLogoFile(file)
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="studio-logo-picker__img" />
            ) : (
              <span className="studio-logo-picker__placeholder">
                <ButtonIcon name="import" />
                <strong>Drop logo or click</strong>
                <small>Transparent PNG or WebP</small>
              </span>
            )}
          </FileDropzone>
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
              confirmRemoveLogo ? (
                <div className="studio-row studio-row--wrap">
                  <button
                    type="button"
                    className="ui-btn ui-btn--sm ui-btn--danger"
                    disabled={avatarBusy}
                    onClick={clearLogo}
                  >
                    Confirm remove
                  </button>
                  <button
                    type="button"
                    className="ui-btn ui-btn--sm ui-btn--ghost"
                    onClick={() => setConfirmRemoveLogo(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ui-btn ui-btn--sm ui-btn--ghost"
                  disabled={avatarBusy}
                  onClick={() => setConfirmRemoveLogo(true)}
                >
                  Remove logo
                </button>
              )
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
    </StudioCollapse>
  )
}
