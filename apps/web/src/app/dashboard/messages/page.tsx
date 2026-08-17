// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { dashboardSessionCookie } from '@/lib/dashboard-session'
import { fetchConversations, fetchMessageContacts } from './actions'
import { ConversationList, MessageContacts } from './_conversation-list'

export default async function MessagesPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/messages')

  const [conversations, contacts] = await Promise.all([
    fetchConversations(),
    fetchMessageContacts(),
  ])

  return (
    <PageShell size="lg" className="dm-page">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Messages</Heading>
        </div>
      </div>

      <div className="dm-workspace">
        <ConversationList conversations={conversations} />
        <MessageContacts contacts={contacts} />
      </div>
    </PageShell>
  )
}
