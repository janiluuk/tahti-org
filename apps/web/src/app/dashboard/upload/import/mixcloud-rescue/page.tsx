// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel } from '@tahti/ui'
import { ImportPageLayout, ImportSteps } from '../_import-page-layout'
import { UploadEntryClient } from '../../_upload-entry-client'

const HOW_IT_WORKS = [
  'Find your own backup of the mix — a local file, an old export, anything you still have',
  'Upload it here like any other track',
  "Tahti tags it as a Mixcloud rescue so listeners see it's a transcode, not your master",
  'Open the editor to fill in title, artist, and tags',
]

export default function MixcloudRescueImportPage() {
  return (
    <ImportPageLayout
      service="mixcloud-rescue"
      title="Rescue a mix from Mixcloud"
      description="Mixcloud doesn't let anyone — including you — download the audio it's hosting, even for your own uploads. There's no way for Tahti to pull the file back automatically. If you still have your own copy of a mix you once put on Mixcloud, upload it here and we'll mark it honestly as a rescue, not a master."
      asideTitle="How it works"
      aside={<ImportSteps steps={HOW_IT_WORKS} />}
    >
      <Panel title="Second-best, and that's OK" className="import-page__panel">
        <p className="import-page__lede">
          This is for mixes you have no other backup of. If you still have the original session,
          export, or master file, upload that instead — it&rsquo;ll sound better and Tahti will show
          it as lossless rather than a rescue.
        </p>
      </Panel>

      <Panel title="Upload your backup" className="import-page__panel">
        <UploadEntryClient source="MIXCLOUD_RESCUE" />
      </Panel>
    </ImportPageLayout>
  )
}
