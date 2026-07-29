// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import {
  AnnouncementTrimEditor,
  type AnnouncementEditorClipSummary,
} from '@/components/announcement-trim-editor'
import { fetchAnnouncementEditorSource, fetchMyAnnouncements, renderAnnouncementTrim } from '../../actions'

export default async function AnnouncementEditorPage({ params }: { params: { id: string } }) {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect(`/login?next=/dashboard/settings/announcements/editor/${params.id}`)

  const user = await getDashboardUser()
  if (!user) redirect(`/login?next=/dashboard/settings/announcements/editor/${params.id}`)
  if (!user.channel) redirect('/dashboard/setup-channel')

  const { clips } = await fetchMyAnnouncements()
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
      backHref="/dashboard/settings/announcements"
      editHrefFor={(id) => `/dashboard/settings/announcements/editor/${id}`}
      fetchSource={fetchAnnouncementEditorSource}
      submitRender={renderAnnouncementTrim}
    />
  )
}
