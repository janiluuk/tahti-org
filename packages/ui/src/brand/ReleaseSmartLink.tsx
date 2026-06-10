// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'
import { coverGradientFromId, type CoverGradient } from '../lib/cover-gradient'
import { CoverArt } from './CoverArt'
import { BrandHeading, BrandText } from './Typography'

export interface ReleaseSmartLinkProps {
  releaseId: string
  title: string
  artistName: string
  releaseType: string
  trackCount?: number
  year: number | string
  artworkUrl?: string | null
  gradient?: CoverGradient
  /** Quote or artist note — pass SafePlainText for linked mentions. */
  quote?: React.ReactNode
  /** UPC, credits, collections — rendered between quote and actions. */
  details?: React.ReactNode
  /** DSP buttons or pre-release countdown slot. */
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

/** Release smart link hero + metadata block — compose with DspLinkButtonList. */
export function ReleaseSmartLink({
  releaseId,
  title,
  artistName,
  releaseType,
  trackCount,
  year,
  artworkUrl,
  gradient,
  quote,
  details,
  children,
  footer,
  className,
}: ReleaseSmartLinkProps) {
  const placeholderGradient = gradient ?? coverGradientFromId(releaseId)
  const metaParts = [
    artistName,
    releaseType,
    trackCount !== undefined ? `${trackCount} track${trackCount === 1 ? '' : 's'}` : undefined,
    String(year),
  ].filter(Boolean)

  return (
    <article className={cn('release-smart-link', className)}>
      <CoverArt
        size="full"
        src={artworkUrl}
        gradient={placeholderGradient}
        alt={`${title} cover art`}
      />
      <BrandHeading level={2} className="release-smart-link__title">
        {title}
      </BrandHeading>
      <BrandText tone="secondary" size="sm" className="release-smart-link__meta">
        {metaParts.join(' · ')}
      </BrandText>
      {quote ? <blockquote className="release-smart-link__quote">{quote}</blockquote> : null}
      {details ? <div className="release-smart-link__details">{details}</div> : null}
      {children ? <div className="release-smart-link__actions">{children}</div> : null}
      {footer ? <footer className="release-smart-link__footer">{footer}</footer> : null}
    </article>
  )
}
