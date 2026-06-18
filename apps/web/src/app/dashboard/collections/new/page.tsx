// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { NewCollectionForm } from './_new-collection-form'

export default function NewCollectionPage() {
  return (
    <div className="collection-new-page">
      <h1 className="collection-new-page__title">New collection</h1>
      <NewCollectionForm />
    </div>
  )
}
