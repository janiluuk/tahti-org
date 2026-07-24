// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { dashboardSessionCookie } from '@/lib/dashboard-session'
import { fetchConversations } from './actions'
import { ConversationList } from './_conversation-list'

export default async function MessagesPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/messages')

  const conversations = await fetchConversations()

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Messages</Heading>
        </div>
      </div>

      <ConversationList conversations={conversations} />
    </PageShell>
  )
}
