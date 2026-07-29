// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  AnnouncementTrimEditor,
  type AnnouncementEditorClipSummary,
} from '@/components/announcement-trim-editor'
import {
  fetchSystemAnnouncementEditorSource,
  fetchSystemAnnouncements,
  renderSystemAnnouncementTrim,
} from '../../actions'

export default async function AdminAnnouncementEditorPage({ params }: { params: { id: string } }) {
  const { clips } = await fetchSystemAnnouncements()
  const summaries: AnnouncementEditorClipSummary[] = clips.map((c) => ({
    id: c.id,
    title: c.title,
    durationSec: c.durationSec,
    renderStatus: c.renderStatus,
  }))

  return (
    <AnnouncementTrimEditor
      clips={summaries}
      initialClipId={params.id}
      backHref="/admin/announcements"
      editHrefFor={(id) => `/admin/announcements/editor/${id}`}
      fetchSource={fetchSystemAnnouncementEditorSource}
      submitRender={renderSystemAnnouncementTrim}
    />
  )
}
