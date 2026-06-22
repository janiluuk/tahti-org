// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import type { ReactNode } from 'react'
import { AvatarTile } from './AvatarTile'
import { ChannelHeader } from './ChannelPageLayout'
import { SafePlainText } from '../lib/safe-plain-text'
import { flagEmoji as countryCodeToFlag } from '../lib/flag-emoji'

function IconPlay() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 3l9 5-9 5V3z" fill="currentColor" />
    </svg>
  )
}

function IconHeart() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 13.5S2 9.5 2 5.5A3.5 3.5 0 0 1 8 3.9a3.5 3.5 0 0 1 6 1.6c0 4-6 8-6 8z"
        fill="currentColor"
      />
    </svg>
  )
}

type ProfileCoverProps = {
  displayName: string
  avatarUrl: string | null
}

/** Full-viewport-width cover banner with avatar. Rendered OUTSIDE the max-width container. */
export function ProfileCover({ displayName, avatarUrl }: ProfileCoverProps) {
  return (
    <div className="prof-cover">
      <div className="prof-cover-overlay" aria-hidden />
      <AvatarTile size="md" name={displayName} src={avatarUrl} bordered className="prof-avatar" />
    </div>
  )
}

type ProfileHeroProps = {
  displayName: string
  username: string
  bio: string | null
  bioHtml?: string | null
  avatarUrl: string | null
  countryCode?: string | null
  /** Resolved country name (e.g. "Finland"); falls back to the raw code if not supplied. */
  countryLabel?: string | null
  isLive?: boolean
  channelHref?: string | null
  subscribeHref: string
  tipJarUrl?: string | null
}

/** PLAT-020: artist profile hero — info row, bio, CTAs. Cover is rendered separately via ProfileCover. */
export function ProfileHero({
  displayName,
  username,
  bio,
  bioHtml,
  avatarUrl: _avatarUrl,
  countryCode,
  countryLabel,
  isLive,
  channelHref,
  subscribeHref,
  tipJarUrl,
}: ProfileHeroProps) {
  return (
    <>
      <div className="prof-info-row">
        <div>
          <div className="prof-name">{displayName}</div>
          <div className="prof-meta-line">
            <span>@{username}</span>
            <span className="prof-country-flag">
              {countryCode ? countryCodeToFlag(countryCode) : '🌍'}{' '}
              {countryCode ? countryLabel || countryCode : 'World citizen'}
            </span>
            {isLive && (
              <span className="prof-live-badge">
                <span className="signal-dot" style={{ width: 6, height: 6 }} aria-hidden />
                ON AIR NOW
              </span>
            )}
          </div>
        </div>
        <div className="prof-cta-row">
          {channelHref && (
            <Link href={channelHref} className="prof-cta-btn">
              <IconPlay />
              Tune in live
            </Link>
          )}
          <Link href={subscribeHref} className="prof-sub-btn">
            <IconHeart />
            Support
          </Link>
          {tipJarUrl && (
            <a href={tipJarUrl} rel="noopener noreferrer" className="prof-tip-btn">
              Tip ↗
            </a>
          )}
        </div>
      </div>

      {bioHtml ? (
        <div className="prof-bio prof-bio--rich" dangerouslySetInnerHTML={{ __html: bioHtml }} />
      ) : (
        bio && <SafePlainText text={bio} className="prof-bio" linkMentions />
      )}

      {isLive && channelHref && (
        <Link href={channelHref} className="prof-embed-row">
          <div className="prof-embed-cover" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path d="M4 3l9 5-9 5V3z" fill="currentColor" />
            </svg>
          </div>
          <div className="prof-embed-info">
            <div className="prof-embed-live-line">
              <span className="signal-dot" style={{ width: 5, height: 5 }} aria-hidden />
              LIVE NOW
            </div>
            <h5>{displayName}</h5>
            <p>Tap to join the broadcast</p>
            <div className="prof-embed-prog" aria-hidden>
              <div className="prof-embed-prog-fill" />
            </div>
          </div>
        </Link>
      )}
    </>
  )
}

type ProfilePageLayoutProps = {
  isLive?: boolean
  /** Smart link / subscribe — back link in header centre */
  contextLink?: { href: string; label: string }
  cover?: ReactNode
  hero: ReactNode
  children: ReactNode
  /** Subscribe flow — max-width var(--narrow-max) */
  narrow?: boolean
}

/** PLAT-020: profile / subscribe page shell. `cover` renders full-width outside the max-width container. */
export function ProfilePageLayout({
  isLive,
  contextLink,
  cover,
  hero,
  children,
  narrow,
}: ProfilePageLayoutProps) {
  return (
    <>
      <ChannelHeader isLive={isLive} contextLink={contextLink} />
      {cover}
      <div className={`prof-page${narrow ? ' prof-page--narrow shell-narrow' : ''}`}>
        {hero}
        <div className="prof-content">{children}</div>
      </div>
    </>
  )
}
