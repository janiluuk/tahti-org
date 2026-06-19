// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel } from '@tahti/ui'
import { StudioFlowLayout, StudioFlowSteps } from '../../_studio-flow-layout'
import { NewCollectionForm } from './_new-collection-form'

const HOW_IT_WORKS = [
  'Name your collection and pick a style (album, DJ-set series, live archive, …)',
  'Choose public or draft visibility',
  'Add tracks from your archive after creation',
  'Reorder on your profile — one track can live in multiple collections',
]

export default function NewCollectionPage() {
  return (
    <StudioFlowLayout
      backHref="/dashboard/collections"
      backLabel="← Collections"
      badgeAbbr="COL"
      badgeTone="collection"
      title="New collection"
      description="Group albums, EPs, DJ sets, or live archives so listeners can explore your work in curated lists."
      asideTitle="How it works"
      aside={<StudioFlowSteps steps={HOW_IT_WORKS} />}
    >
      <Panel
        title="Collection details"
        description="You can change name, style, and visibility later from the collection editor."
        className="import-page__panel"
      >
        <NewCollectionForm />
      </Panel>
    </StudioFlowLayout>
  )
}
