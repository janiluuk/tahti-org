// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Heading, PageShell, Panel, Text } from '@tahti/ui'

export type ImportService = 'soundcloud' | 'bandcamp' | 'url' | 'broadcast'

const SERVICE_META: Record<
  ImportService,
  { label: string; abbr: string; tone: 'soundcloud' | 'bandcamp' | 'url' | 'broadcast' }
> = {
  soundcloud: { label: 'SoundCloud', abbr: 'SC', tone: 'soundcloud' },
  bandcamp: { label: 'Bandcamp', abbr: 'BC', tone: 'bandcamp' },
  url: { label: 'Smart link', abbr: 'URL', tone: 'url' },
  broadcast: { label: 'Broadcast', abbr: 'LIVE', tone: 'broadcast' },
}

export function ImportSteps({ steps }: { steps: string[] }) {
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

export function ImportServiceTags({ services }: { services: string[] }) {
  return (
    <ul className="import-page__service-tags">
      {services.map((service) => (
        <li key={service} className="import-page__service-tag">
          {service}
        </li>
      ))}
    </ul>
  )
}

export function ImportPageLayout({
  service,
  title,
  description,
  children,
  asideTitle,
  aside,
}: {
  service: ImportService
  title: string
  description: string
  children: ReactNode
  asideTitle: string
  aside: ReactNode
}) {
  const meta = SERVICE_META[service]

  return (
    <PageShell size="md" className="import-page">
      <header className="studio-page-header import-page__header">
        <div className="import-page__header-main">
          <Link href="/dashboard/upload" className="import-page__back">
            ← Add content
          </Link>
          <div className="import-page__title-row">
            <span
              className={`import-page__service-badge import-page__service-badge--${meta.tone}`}
              aria-hidden
            >
              {meta.abbr}
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
