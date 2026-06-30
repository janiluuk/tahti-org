// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import NewsletterPanel from '../../newsletter-panel'

interface FanTier {
  active: boolean
  perks: string[]
}

interface NewsletterStats {
  total: number
  confirmed: number
  newLast30Days: number
  fanSubscriberCount: number
}

interface NewsletterDraft {
  id: string
  subject: string
  state: string
  sentAt: string | null
  createdAt: string
  subscribersOnly: boolean
  _count: { sends: number }
}

export default async function NewsletterComposePage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/newsletter/compose')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/newsletter/compose')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const authHeaders = { Cookie: `tahti_session=${sessionValue}` }
  const get = (path: string) =>
    fetch(`${apiUrl}${path}`, { headers: authHeaders, cache: 'no-store' as const })

  let fanTiers: FanTier[] = []
  let newsletterStats: NewsletterStats = {
    total: 0,
    confirmed: 0,
    newLast30Days: 0,
    fanSubscriberCount: 0,
  }
  let newsletterDrafts: NewsletterDraft[] = []

  try {
    const [fanTiersRes, statsRes, draftsRes] = await Promise.all([
      get('/api/me/fan-tiers'),
      get('/api/me/newsletter/subscribers'),
      get('/api/me/newsletter/drafts'),
    ])
    if (fanTiersRes.ok) fanTiers = (await fanTiersRes.json()) as FanTier[]
    if (statsRes.ok) newsletterStats = (await statsRes.json()) as NewsletterStats
    if (draftsRes.ok) newsletterDrafts = (await draftsRes.json()) as NewsletterDraft[]
  } catch {
    // render with partial data
  }

  const hasFanNewsletterPerk = fanTiers.some(
    (t) => t.active && t.perks.some((p) => p === 'FAN_NEWSLETTER'),
  )

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Newsletter</h1>
          <Text tone="muted" size="sm">
            Write to your fans and newsletter subscribers.
          </Text>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel
            isLive={user.channel.state === 'LIVE'}
            channelSlug={user.channel.slug}
            showBack
          />
        </div>
      </div>

      <NewsletterPanel
        initialStats={newsletterStats}
        initialDrafts={newsletterDrafts}
        hasFanNewsletterPerk={hasFanNewsletterPerk}
        tier={user.tier}
        displayName={user.displayName}
      />
    </PageShell>
  )
}
