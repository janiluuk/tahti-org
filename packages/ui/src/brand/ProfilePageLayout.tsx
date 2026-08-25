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

function IconMore() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.5" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="8" r="1.3" fill="currentColor" />
    </svg>
  )
}

function IconTip() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.5v7M6.2 6.2h2.7a1.5 1.5 0 0 1 0 3H7"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
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
  /** Additional icon action rendered in the top overflow menu. */
  moreActionSlot?: ReactNode
  /** Lets the page render a labelled biography section in its main content. */
  hideBio?: boolean
  /** Compact row of social/streaming-platform icon links (apps/web builds
   * these from Channel.socialLinks) — rendered right under the name/meta
   * line, next to the rest of the profile info, instead of buried further
   * down the Home tab. */
  socialLinksSlot?: ReactNode
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
  moreActionSlot,
  hideBio = false,
  socialLinksSlot,
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
            {countryCode ? (
              <span className="prof-country-flag">
                {countryCodeToFlag(countryCode)} {countryLabel || countryCode}
              </span>
            ) : null}
            {isLive && (
              <span className="prof-live-badge">
                <span className="signal-dot" style={{ width: 6, height: 6 }} aria-hidden />
                ON AIR
              </span>
            )}
            {joinDateLabel && (
              <span className="prof-join-date" title={joinDateTitle}>
                {joinDateLabel}
              </span>
            )}
          </div>
          {socialLinksSlot && <div className="prof-header-social-links">{socialLinksSlot}</div>}
        </div>
        <div className="prof-cta-row">
          {channelHref && isLive ? (
            <Link href={channelHref} className="prof-cta-btn">
              <IconPlay />
              Tune in
            </Link>
          ) : null}
          {followSlot}
          {showSupport ? (
            <Link href={subscribeHref} className="prof-sub-btn">
              <IconHeart />
              Support
            </Link>
          ) : null}
          {(newsletterSlot ||
            tipJarUrl ||
            rssUrl ||
            presskitUrl ||
            messageSlot ||
            moreActionSlot) && (
            <details className="prof-cta-more">
              <summary className="prof-icon-btn" title="More" aria-label="More actions">
                <IconMore />
              </summary>
              <div className="prof-cta-more__menu">
                {messageSlot}
                {newsletterSlot}
                {tipJarUrl && (
                  <a
                    href={tipJarUrl}
                    rel="noopener noreferrer"
                    className="prof-icon-btn"
                    title="Tip artist"
                    aria-label="Tip artist"
                  >
                    <IconTip />
                  </a>
                )}
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
                {moreActionSlot}
              </div>
            </details>
          )}
        </div>
      </div>

      {!hideBio && bioHtml ? (
        <div className="prof-bio prof-bio--rich" dangerouslySetInnerHTML={{ __html: bioHtml }} />
      ) : (
        !hideBio && bio && <SafePlainText text={bio} className="prof-bio" linkMentions />
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
  logoutAction?: (formData: FormData) => void | Promise<void>
  /** Strips the top bar to just the logo — see ChannelHeader's logoOnly. */
  logoOnly?: boolean
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
  logoutAction,
  logoOnly,
}: ProfilePageLayoutProps) {
  return (
    <>
      <ChannelHeader
        isLive={isLive}
        contextLink={contextLink}
        activeNav={activeNav}
        user={user}
        logoutAction={logoutAction}
        logoOnly={logoOnly}
      />
      {cover}
      <div className={`prof-page${narrow ? ' prof-page--narrow shell-narrow' : ''}`}>
        {hero}
        <div className="prof-content">{children}</div>
      </div>
      {!narrow && <PublicFooter />}
    </>
  )
}
