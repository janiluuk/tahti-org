// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import React from 'react'
import { cn } from '../lib/cn'

export interface TierCardProps {
  name: string
  /** Formatted price, e.g. "€5.00". */
  priceLabel: string
  period?: string
  description?: string
  perks?: string[]
  featured?: boolean
  featuredLabel?: string
  onSubscribe?: () => void
  subscribeLabel?: string
  disabled?: boolean
  /** Custom action slot instead of default subscribe button. */
  action?: React.ReactNode
  className?: string
}

function PerkCheck() {
  return (
    <svg
      className="tier-card__check"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 8l4 4 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Fan-subscription tier card for `/u/:handle/subscribe`. */
export function TierCard({
  name,
  priceLabel,
  period = '/mo',
  description,
  perks = [],
  featured = false,
  featuredLabel = 'Most chosen',
  onSubscribe,
  subscribeLabel = 'Subscribe',
  disabled = false,
  action,
  className,
}: TierCardProps) {
  return (
    <article className={cn('tier-card', featured && 'tier-card--featured', className)}>
      {featured ? <span className="tier-card__badge">{featuredLabel}</span> : null}
      <h3 className="tier-card__name">{name}</h3>
      <div className="tier-card__price">
        {priceLabel}
        <span className="tier-card__period">{period}</span>
      </div>
      {description ? <p className="tier-card__desc">{description}</p> : null}
      {perks.length > 0 ? (
        <ul className="tier-card__perks">
          {perks.map((perk) => (
            <li key={perk} className="tier-card__perk">
              <PerkCheck />
              {perk}
            </li>
          ))}
        </ul>
      ) : null}
      {action ?? (
        <button
          type="button"
          className="tier-card__subscribe"
          onClick={onSubscribe}
          disabled={disabled}
        >
          {subscribeLabel}
        </button>
      )}
    </article>
  )
}

export interface TierCardGridProps {
  children: React.ReactNode
  className?: string
}

export function TierCardGrid({ children, className }: TierCardGridProps) {
  return <div className={cn('tier-card-grid', className)}>{children}</div>
}
