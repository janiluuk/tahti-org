// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Heading, PageShell, Panel, Text } from '@tahti/ui'

export type StudioFlowBadgeTone =
  | 'soundcloud'
  | 'bandcamp'
  | 'url'
  | 'broadcast'
  | 'collection'
  | 'google-drive'
  | 'mixcloud-rescue'

export function StudioFlowSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="import-page__steps">
      {steps.map((step, i) => (
        <li key={step} className="import-page__step">
          <span className="import-page__step-num" aria-hidden>
            {i + 1}
          </span>
          <span className="import-page__step-text">{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function StudioFlowTags({ items }: { items: string[] }) {
  return (
    <ul className="import-page__service-tags">
      {items.map((item) => (
        <li key={item} className="import-page__service-tag">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function StudioFlowLayout({
  backHref,
  backLabel,
  badgeAbbr,
  badgeTone,
  title,
  description,
  children,
  asideTitle,
  aside,
  size = 'md',
}: {
  backHref: string
  backLabel: string
  badgeAbbr: string
  badgeTone: StudioFlowBadgeTone
  title: string
  description: string
  children: ReactNode
  asideTitle: string
  aside: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <PageShell size={size} className="import-page">
      <header className="studio-page-header import-page__header">
        <div className="import-page__header-main">
          <Link href={backHref} className="import-page__back">
            {backLabel}
          </Link>
          <div className="import-page__title-row">
            <span
              className={`import-page__service-badge import-page__service-badge--${badgeTone}`}
              aria-hidden
            >
              {badgeAbbr}
            </span>
            <Heading level={1}>{title}</Heading>
          </div>
          <Text as="p" tone="muted" className="import-page__lede">
            {description}
          </Text>
        </div>
      </header>

      <div className="import-page__grid">
        <div className="import-page__main">{children}</div>
        <aside className="import-page__aside">
          <Panel title={asideTitle} className="import-page__aside-panel">
            {aside}
          </Panel>
        </aside>
      </div>
    </PageShell>
  )
}
