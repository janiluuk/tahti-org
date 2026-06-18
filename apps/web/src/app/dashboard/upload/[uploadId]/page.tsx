// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { UploadInProgress } from './_upload-in-progress'
import { fetchCollectionOptions } from '../upload-actions'

export default async function UploadInProgressPage({ params }: { params: { uploadId: string } }) {
  const collectionOptions = await fetchCollectionOptions()
  return (
    <UploadInProgress
      uploadId={decodeURIComponent(params.uploadId)}
      collectionOptions={collectionOptions}
    />
  )
}
