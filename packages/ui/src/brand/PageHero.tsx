// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { AvatarTile } from './AvatarTile'
import type { CoverGradient } from '../lib/cover-gradient'

export interface PageHeroStat {
  label: string
  value: string | number
  /** Optional link (e.g. followers → the followers modal, tracks → the tracks tab). */
  href?: string
}

export interface PageHeroProps {
  /** Large identity image — an artist's avatar, an album's artwork, a
   * collection's cover. Falls back to initials-on-gradient via AvatarTile
   * when absent. */
  avatarUrl?: string | null
  avatarPosterUrl?: string | null
  avatarThemeBackground?: string | null
  avatarLogoUrl?: string | null
  avatarGradient?: CoverGradient
  /** Full-bleed ambient wash behind the whole hero — a blurred cover/backdrop
   * image, or an explicit CSS background (gradient, solid color). Omit for a
   * flat `--card` background. */
  backdropUrl?: string | null
  title: string
  /** Rendered inline right after the title — pronouns, a live badge, etc. */
  titleExtra?: ReactNode
  /** e.g. "@username", or "Album · 2026" — the line directly under the title. */
  subtitle?: ReactNode
  /** A further line under the subtitle — bio excerpt, description, join date. */
  meta?: ReactNode
  /** Quick-facts row (follower count, track count, release count, ...). Renders
   * nothing when empty, so callers don't need to conditionally omit the prop. */
  stats?: PageHeroStat[]
  /** Follow / Support / Subscribe / Share — right-aligned action row. */
  actions?: ReactNode
  className?: string
}

/** Shared "who/what is this page about" header — one avatar-or-cover-art tile,
 * title/subtitle/meta, an optional quick-facts stats row, and an action row,
 * all in one bordered card over an optional ambient backdrop. Modeled on the
 * most complete of Tahti Player's own three header treatments (its Collection/
 * Playlist page), reimplemented with this app's own design tokens rather than
 * that app's Tailwind/neobrutalist ones. Used by the artist profile, channel,
 * and release pages so "what does this page's header look like" has one
 * answer instead of three separate bespoke implementations. */
export function PageHero({
  avatarUrl,
  avatarPosterUrl,
  avatarThemeBackground,
  avatarLogoUrl,
  avatarGradient,
  backdropUrl,
  title,
  titleExtra,
  subtitle,
  meta,
  stats,
  actions,
  className,
}: PageHeroProps) {
  return (
    <div className={cn('page-hero', className)}>
      {backdropUrl && (
        <div
          className="page-hero__backdrop"
          style={{ ['--page-hero-backdrop' as string]: `url(${backdropUrl})` }}
          aria-hidden
        />
      )}
      <div className="page-hero__card">
        <AvatarTile
          size="lg"
          name={title}
          src={avatarUrl}
          posterUrl={avatarPosterUrl}
          themeBackground={avatarThemeBackground}
          logoUrl={avatarLogoUrl}
          gradient={avatarGradient}
          bordered
          className="page-hero__avatar"
        />
        <div className="page-hero__body">
          <h1 className="page-hero__title">
            {title}
            {titleExtra}
          </h1>
          {subtitle && <div className="page-hero__subtitle">{subtitle}</div>}
          {meta && <div className="page-hero__meta">{meta}</div>}
          {stats && stats.length > 0 && (
            <div className="page-hero__stats" role="list">
              {stats.map((stat) =>
                stat.href ? (
                  <a key={stat.label} href={stat.href} className="page-hero__stat" role="listitem">
                    <span className="page-hero__stat-value">{stat.value}</span>
                    <span className="page-hero__stat-label">{stat.label}</span>
                  </a>
                ) : (
                  <div key={stat.label} className="page-hero__stat" role="listitem">
                    <span className="page-hero__stat-value">{stat.value}</span>
                    <span className="page-hero__stat-label">{stat.label}</span>
                  </div>
                ),
              )}
            </div>
          )}
          {actions && <div className="page-hero__actions">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
