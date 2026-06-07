// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Heading, PageShell, Text } from '@tahti/ui'
import { ChatModerationPanel, type ChatBanRow } from './chat-moderation-panel'

export default async function ModerateChannelPage({ params }: { params: { slug: string } }) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(
    `${apiUrl}/api/me/moderate/${encodeURIComponent(params.slug)}/chat/bans`,
    {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    },
  )
  if (res.status === 404) notFound()
  if (!res.ok) {
    return (
      <PageShell>
        <Heading level={1}>Chat moderation</Heading>
        <p className="studio-text-error">Could not load this channel&apos;s chat bans.</p>
        <Link href="/dashboard" className="studio-btn-ghost">
          Back to dashboard
        </Link>
      </PageShell>
    )
  }

  const bans = (await res.json()) as ChatBanRow[]

  return (
    <PageShell>
      <div className="studio-row studio-row--between studio-mb-lg">
        <div>
          <Heading level={1}>Chat moderation</Heading>
          <Text tone="secondary" className="studio-mt-sm">
            Moderating <Link href={`/c/${params.slug}`}>{params.slug}.tahti.live</Link>
          </Text>
        </div>
        <Link href="/dashboard" className="studio-btn-ghost">
          Back to dashboard
        </Link>
      </div>
      <ChatModerationPanel slug={params.slug} initial={bans} />
    </PageShell>
  )
}
