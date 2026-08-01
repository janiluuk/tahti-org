// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { PageShell, Heading } from '@tahti/ui'
import { dashboardSessionCookie } from '@/lib/dashboard-session'
import { fetchConversation } from '../actions'
import { ConversationThread } from './_conversation-thread'

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/messages')

  const conversation = await fetchConversation(params.id)
  if (!conversation) notFound()

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Link href="/dashboard/messages" className="studio-text-muted-sm">
            ← Messages
          </Link>
          <Heading level={1}>{conversation.otherUser.displayName}</Heading>
          <p className="studio-text-muted-sm">
            @{conversation.otherUser.username}
            {conversation.otherUser.channelRole === 'owner' ? (
              <span className="dm-role-badge dm-role-badge--owner">Owner</span>
            ) : conversation.otherUser.channelRole === 'moderator' ? (
              <span className="dm-role-badge dm-role-badge--moderator">Mod</span>
            ) : null}
          </p>
        </div>
      </div>

      <ConversationThread conversationId={conversation.id} initial={conversation} />
    </PageShell>
  )
}
