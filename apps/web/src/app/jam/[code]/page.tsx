// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { JamView } from './_jam-view'

export const metadata: Metadata = {
  title: 'Tahti Jam',
  description: 'Listen to a playlist together, in sync, with friends.',
}

export default async function JamPage({ params }: { params: { code: string } }) {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect(`/login?next=${encodeURIComponent(`/jam/${params.code}`)}`)

  const user = await getDashboardUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/jam/${params.code}`)}`)

  return <JamView code={params.code} userId={user.id} />
}
