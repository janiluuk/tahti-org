// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import React, { type ReactNode } from 'react'
import { AvatarTile } from './AvatarTile'
import { ChannelHeader, type SiteNavId } from './ChannelPageLayout'
import { PublicFooter } from './PublicFooter'
import { SafePlainText } from '../lib/safe-plain-text'
import { flagEmoji as countryCodeToFlag } from '../lib/flag-emoji'
import { cn } from '../lib/cn'

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

function IconRss() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.2" cy="12.8" r="1.6" fill="currentColor" />
      <path
        d="M2 6.5c4.7 0 7.5 2.8 7.5 7.5M2 2c7.2 0 12 4.8 12 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 2v8m0 0 3-3m-3 3-3-3M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type ProfileCoverProps = {
  displayName: string
  avatarUrl: string | null
  /** Static poster frame — present only when avatarUrl is an animated GIF,
   * so the avatar shows a still frame at rest and plays on hover. */
  avatarPosterUrl?: string | null
  /** CSS background for the cover banner (and avatar fill when no photo). */
  themeBackground?: string | null
  /** Alpha logo URL. */
  logoUrl?: string | null
  /** Print logo on the cover banner. */
  logoOnCover?: boolean
  /** Print logo on the hanging avatar. */
  logoOnAvatar?: boolean
}

/** Full-viewport-width cover banner with avatar. Rendered OUTSIDE the max-width container. */
export function ProfileCover({
  displayName,
  avatarUrl,
  avatarPosterUrl,
  themeBackground,
  logoUrl,
  logoOnCover = false,
  logoOnAvatar = false,
}: ProfileCoverProps) {
  const coverStyle = themeBackground
    ? ({ ['--prof-cover-theme' as string]: themeBackground } as React.CSSProperties)
    : undefined

  return (
    <div className={cn('prof-cover', themeBackground && 'prof-cover--themed')} style={coverStyle}>
      <div className="prof-cover-overlay" aria-hidden />
      {logoOnCover && logoUrl ? (
        <img src={logoUrl} alt="" className="prof-cover-logo" loading="lazy" decoding="async" />
      ) : null}
      <AvatarTile
        size="md"
        name={displayName}
        src={avatarUrl}
        posterUrl={avatarPosterUrl}
        themeBackground={themeBackground}
        logoUrl={logoOnAvatar ? logoUrl : null}
        bordered
        className="prof-avatar"
      />
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
  pronouns?: string | null
  isLive?: boolean
  channelHref?: string | null
  subscribeHref: string
  /** When false, hide the Support CTA (no tiers / payments). Defaults to true. */
  showSupport?: boolean
  tipJarUrl?: string | null
  /** Pre-formatted, e.g. "Member since 8 months" — resolved by the caller so this component stays locale-agnostic. */
  joinDateLabel?: string | null
  /** Precise form shown on hover, e.g. "Member since November 2025". */
  joinDateTitle?: string
  /** The newsletter subscribe control (apps/web's NewsletterSubscribeForm) — a slot
   * rather than a prop this component builds itself, since it needs client-side
   * fetch/state that doesn't belong in a presentational packages/ui component.
   * Rendered inline in the CTA row, next to Support. */
  newsletterSlot?: ReactNode
  /** The free follow/subscribe control (apps/web's FollowButton) — same slot
   * pattern as newsletterSlot, for the same reason. Rendered first in the CTA
   * row, ahead of Support. */
  followSlot?: ReactNode
  /** The direct-message control (apps/web's SendMessageButton) — same slot
   * pattern as followSlot. Rendered right after Support, per spec ("grouped
   * with the support artist button"). */
  messageSlot?: ReactNode
  /** Press kit ZIP download — compact icon button up in the CTA row rather than
   * buried in the Stage tab, so it's reachable without digging. */
  presskitUrl?: string | null
  /** Archive RSS feed — same top-row treatment as presskitUrl. */
  rssUrl?: string | null
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
  pronouns,
  isLive,
  channelHref,
  subscribeHref,
  showSupport = true,
  tipJarUrl,
  joinDateLabel,
  joinDateTitle,
  newsletterSlot,
  followSlot,
  messageSlot,
  presskitUrl,
  rssUrl,
}: ProfileHeroProps) {
  return (
    <>
      <div className="prof-info-row">
        <div>
          <div className="prof-name">
            {displayName}
            {pronouns && <span className="prof-pronouns">{pronouns}</span>}
          </div>
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
            {joinDateLabel && (
              <span className="prof-join-date" title={joinDateTitle}>
                {joinDateLabel}
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
          {followSlot}
          {showSupport ? (
            <Link href={subscribeHref} className="prof-sub-btn">
              <IconHeart />
              Support
            </Link>
          ) : null}
          {messageSlot}
          {newsletterSlot}
          {rssUrl && (
            <a
              href={rssUrl}
              rel="alternate"
              className="prof-icon-btn"
              title="RSS feed"
              aria-label="RSS feed"
            >
              <IconRss />
            </a>
          )}
          {presskitUrl && (
            <a
              href={presskitUrl}
              rel="nofollow"
              className="prof-icon-btn"
              title="Download press kit"
              aria-label="Download press kit"
            >
              <IconDownload />
            </a>
          )}
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
  /** Highlights the current top-nav item. Artist profiles and their sub-pages
   * (collections, etc.) live under Discover, so callers should pass
   * activeNav="discover" — without it, ChannelHeader's pathname fallback can
   * never match a dynamic /u/[username] route and no nav item lights up,
   * leaving the visitor with no sense of where they are in the site. */
  activeNav?: SiteNavId
  cover?: ReactNode
  hero: ReactNode
  children: ReactNode
  /** Subscribe flow — max-width var(--narrow-max) */
  narrow?: boolean
  /** Logged-in viewer — shows their name/avatar instead of "Sign in" in the header. */
  user?: { username: string; displayName: string; hasChannel?: boolean } | null
}

/** PLAT-020: profile / subscribe page shell. `cover` renders full-width outside the max-width container. */
export function ProfilePageLayout({
  isLive,
  contextLink,
  activeNav,
  cover,
  hero,
  children,
  narrow,
  user,
}: ProfilePageLayoutProps) {
  return (
    <>
      <ChannelHeader isLive={isLive} contextLink={contextLink} activeNav={activeNav} user={user} />
      {cover}
      <div className={`prof-page${narrow ? ' prof-page--narrow shell-narrow' : ''}`}>
        {hero}
        <div className="prof-content">{children}</div>
      </div>
      {!narrow && <PublicFooter />}
    </>
  )
}
