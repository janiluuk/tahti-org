// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export type DspPlatform =
  | 'spotify'
  | 'apple'
  | 'bandcamp'
  | 'tidal'
  | 'soundcloud'
  | 'youtube'
  | 'deezer'
  | 'amazon'
  | 'tahti'
  | 'generic'

export interface DspLinkButtonProps {
  href: string
  platform: DspPlatform
  /** Platform display name, e.g. "Spotify". */
  label: string
  /** Short verb, e.g. "Stream" or "FLAC · best quality". */
  verb: string
  primary?: boolean
  /** Override the default platform icon. */
  icon?: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  className?: string
}

function PlatformIcon({ platform }: { platform: DspPlatform }) {
  switch (platform) {
    case 'spotify':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2.5 5c3.5-2.2 7.5-2.2 11 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M3 8c3-1.8 7-1.8 10 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M4 11c2-1.2 6-1.2 8 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'apple':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6.5 11.5V5l6-1.5v2.5L6.5 7.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="5" cy="11.5" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'bandcamp':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M2 11l4-6h4l-4 6H2z" fill="currentColor" />
          <path d="M8 11l4-6h2l-4 6H8z" fill="currentColor" />
        </svg>
      )
    case 'tidal':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 7.5c1-1.5 2-1.5 3 0s2 1.5 3 0 2-1.5 3 0 2 1.5 3 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M2 10c1-1.5 2-1.5 3 0s2 1.5 3 0 2-1.5 3 0 2 1.5 3 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'soundcloud':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 11h11a2.5 2.5 0 0 0 0-5 4 4 0 0 0-7.5-1.5A2.5 2.5 0 0 0 2 8v3z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'youtube':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect
            x="1.5"
            y="3.5"
            width="13"
            height="9"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <path d="M6.5 6l4 2-4 2V6z" fill="currentColor" />
        </svg>
      )
    case 'deezer':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="2" y="9" width="2" height="4" rx="1" fill="currentColor" />
          <rect x="5.5" y="6.5" width="2" height="6.5" rx="1" fill="currentColor" />
          <rect x="9" y="4" width="2" height="9" rx="1" fill="currentColor" />
          <rect x="12.5" y="7" width="2" height="6" rx="1" fill="currentColor" />
        </svg>
      )
    case 'amazon':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 9.5c2.5 2.5 7.5 2.5 10 0"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M12.5 11.5l1.5-2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      )
    case 'tahti':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2l1.6 4.2H14l-3.5 2.6 1.3 4.2L8 10.5l-3.8 2.5 1.3-4.2L2 6.2h4.4z"
            fill="currentColor"
          />
        </svg>
      )
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      )
  }
}

/** Single DSP row on release smart link pages. */
export function DspLinkButton({
  href,
  platform,
  label,
  verb,
  primary = false,
  icon,
  onClick,
  className,
}: DspLinkButtonProps) {
  return (
    <a
      href={href}
      className={cn('dsp-link-btn', primary && 'dsp-link-btn--primary', className)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
    >
      <span className="dsp-link-btn__icon">{icon ?? <PlatformIcon platform={platform} />}</span>
      <span className="dsp-link-btn__body">
        <span className="dsp-link-btn__label">{label}</span>
        <span className="dsp-link-btn__verb">{verb}</span>
      </span>
      <span className="dsp-link-btn__arrow" aria-hidden>
        →
      </span>
    </a>
  )
}

export function DspLinkButtonList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('dsp-link-btn-list', className)}>{children}</div>
}
