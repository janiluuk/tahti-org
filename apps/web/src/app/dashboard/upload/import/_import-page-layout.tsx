// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import {
  StudioFlowLayout,
  StudioFlowSteps,
  StudioFlowTags,
  type StudioFlowBadgeTone,
} from '../../_studio-flow-layout'

export type ImportService =
  | 'soundcloud'
  | 'bandcamp'
  | 'url'
  | 'broadcast'
  | 'google-drive'
  | 'mixcloud-rescue'

const SERVICE_META: Record<ImportService, { abbr: string; tone: StudioFlowBadgeTone }> = {
  soundcloud: { abbr: 'SC', tone: 'soundcloud' },
  bandcamp: { abbr: 'BC', tone: 'bandcamp' },
  url: { abbr: 'URL', tone: 'url' },
  broadcast: { abbr: 'LIVE', tone: 'broadcast' },
  'google-drive': { abbr: 'GD', tone: 'google-drive' },
  'mixcloud-rescue': { abbr: 'MC', tone: 'mixcloud-rescue' },
}

export const ImportSteps = StudioFlowSteps

export function ImportServiceTags({ services }: { services: string[] }) {
  return <StudioFlowTags items={services} />
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
    <StudioFlowLayout
      backHref="/dashboard/upload"
      backLabel="← Add content"
      badgeAbbr={meta.abbr}
      badgeTone={meta.tone}
      title={title}
      description={description}
      asideTitle={asideTitle}
      aside={aside}
    >
      {children}
    </StudioFlowLayout>
  )
}
