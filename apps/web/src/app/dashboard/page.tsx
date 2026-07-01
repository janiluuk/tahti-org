// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, SidebarNavIconSvg } from '@tahti/ui'
import NextLink from 'next/link'
import { DashboardOverview } from './_dashboard-overview'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { resolveChannelUrl } from '@/lib/app-url'

interface ModeratedChannel {
  slug: string
  displayName: string
  isOwner: boolean
}

export default async function DashboardPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const user = await getDashboardUser()
  if (!user) {
    redirect('/login')
  }

  const authHeaders = { Cookie: `tahti_session=${sessionValue}` }
  const get = (path: string) =>
    fetch(`${apiUrl}${path}`, { headers: authHeaders, cache: 'no-store' as const })
  const slug = user.channel?.slug

  type MembershipInfo = {
    status: string
    isMember: boolean
    memberNumber: number | null
    priceCents: number
    emailVerified: boolean
    renewalDueAt?: string | null
    hasStripeSubscription?: boolean
    subscriptionMigrationRequired?: boolean
  }
  type BroadcastUsageInfo = {
    unlimited: boolean
    secondsUsed: number
    secondsRemaining: number | null
    warnings: number[]
    warningLevel?: 'none' | '45m' | '55m' | 'grace' | 'blocked'
    atCap: boolean
    inGrace?: boolean
    blocked?: boolean
    showUpgradeCta?: boolean
    weeklyCapSeconds: number
  }

  let moderatedChannels: ModeratedChannel[] = []
  let membershipInfo: MembershipInfo | null = null
  let broadcastUsage: BroadcastUsageInfo | null = null
  let downloadGateSummary: {
    artistFollowerCount: number
    totals: { repostAcks: number; blockedAttempts: number; countedDownloads?: number }
    daily?: Array<{
      date: string
      repostAcks: number
      blockedAttempts: number
      countedDownloads: number
    }>
    items: Array<{
      archiveItemId: string
      title: string
      repostToDownload: boolean
      followToDownload: boolean
      repostAckCount: number
      blockedDownloadAttempts: number
      countedDownloadCount?: number
    }>
  } | null = null
  let channelEgress: {
    windowDays: number
    totalBytes: number
    totalDownloads: number
    daily: Array<{ date: string; bytes: number; downloads: number }>
  } | null = null
  let channelLiveStats: {
    windowDays: number
    totalLiveSeconds: number
    totalBroadcasts: number
    peakDailyListeners: number
    daily: Array<{ date: string; liveSeconds: number; broadcastCount: number; listeners: number }>
  } | null = null
  let fanPayoutStats = { pending: 0, failed: 0, paidLast30Days: 0 }
  let archiveItemsForEdit: Array<
    Record<string, unknown> & { id: string; title: string; status: string }
  > = []
  let liveBroadcastTitle: string | null = null
  const isOnAir = user.channel?.state === 'LIVE' || user.channel?.state === 'PREVIEW'
  try {
    const [
      moderatedRes,
      membershipRes,
      broadcastUsageRes,
      funnelRes,
      fanPayoutsRes,
      archiveRes,
      preflightRes,
    ] = await Promise.all([
      get('/api/me/moderate'),
      get('/api/me/membership'),
      slug ? get('/api/me/broadcast-usage') : null,
      slug ? get('/api/me/channel-funnel-stats') : null,
      slug ? get('/api/me/fan-sub-payouts') : null,
      slug ? get('/api/me/archive') : null,
      slug && isOnAir ? get('/api/me/channel/preflight') : null,
    ])

    if (moderatedRes.ok) moderatedChannels = (await moderatedRes.json()) as ModeratedChannel[]
    if (membershipRes.ok) membershipInfo = (await membershipRes.json()) as MembershipInfo
    if (broadcastUsageRes?.ok) {
      broadcastUsage = (await broadcastUsageRes.json()) as BroadcastUsageInfo
    }
    if (funnelRes?.ok) {
      const funnel = (await funnelRes.json()) as {
        downloadGates: NonNullable<typeof downloadGateSummary>
        live: NonNullable<typeof channelLiveStats>
        egress: NonNullable<typeof channelEgress>
      }
      downloadGateSummary = funnel.downloadGates
      channelLiveStats = funnel.live
      channelEgress = funnel.egress
    }
    if (fanPayoutsRes?.ok) fanPayoutStats = (await fanPayoutsRes.json()) as typeof fanPayoutStats
    if (archiveRes?.ok) {
      archiveItemsForEdit = (await archiveRes.json()) as typeof archiveItemsForEdit
    }
    if (preflightRes?.ok) {
      const preflight = (await preflightRes.json()) as { title: string | null }
      liveBroadcastTitle = preflight.title
    }
  } catch {
    // ignore — dashboard renders with partial data
  }

  const otherModeratedChannels = moderatedChannels.filter((c) => !c.isOwner)

  const statDlCount =
    (downloadGateSummary as { totals: { countedDownloads?: number } } | null)?.totals
      .countedDownloads ?? 0
  const weeklyListeners = Math.max(
    0,
    ...((channelLiveStats as { daily: Array<{ listeners: number }> } | null)?.daily ?? [])
      .slice(-7)
      .map((d) => d.listeners),
  )

  const now = new Date()
  const helsinkiHour = (now.getUTCHours() + 3) % 24
  const greeting =
    helsinkiHour < 5
      ? 'Good night'
      : helsinkiHour < 12
        ? 'Good morning'
        : helsinkiHour < 17
          ? 'Good afternoon'
          : helsinkiHour < 21
            ? 'Good evening'
            : 'Good night'
  const firstName = user.displayName.trim().split(/\s+/)[0] ?? user.displayName

  const headerState = user.channel?.state
  const headerStatusLabel =
    headerState === 'LIVE'
      ? 'broadcasting live'
      : headerState === 'PREVIEW'
        ? 'in preview'
        : 'offline'
  const headerStatusClass =
    headerState === 'LIVE'
      ? ' db-header-channel-state--live'
      : headerState === 'PREVIEW'
        ? ' db-header-channel-state--preview'
        : ''
  const headerDotClass =
    headerState === 'LIVE'
      ? 'signal-dot'
      : headerState === 'PREVIEW'
        ? 'db-preview-dot'
        : 'db-offline-dot'
  const goLiveBtnLabel =
    headerState === 'LIVE'
      ? 'On air'
      : headerState === 'PREVIEW'
        ? 'Continue to go live →'
        : 'Go live →'
  const goLiveBtnClass =
    headerState === 'LIVE'
      ? ' db-go-live-btn--live'
      : headerState === 'PREVIEW'
        ? ' db-go-live-btn--preview'
        : ''

  return (
    <PageShell size="md">
      <div className="studio-section-anchor studio-page-header">
        <div>
          <div className="db-greeting">
            {greeting}, {firstName}.
          </div>
          <div className="db-greeting-status">
            {user.channel ? (
              <>
                <span className={`db-header-channel-state${headerStatusClass}`}>
                  <span className={headerDotClass} aria-hidden />
                  {headerStatusLabel}
                </span>
                <span>·</span>
                <NextLink
                  href={resolveChannelUrl(user.channel.slug)}
                  className="db-header-channel-url"
                >
                  {user.channel.slug}.tahti.live
                </NextLink>
              </>
            ) : (
              <span>{user.displayName}</span>
            )}
          </div>
          <div className="db-role-row" style={{ marginTop: '0.5rem' }}>
            {user.isBoard && (
              <NextLink href="/admin" className="db-role-badge db-role-badge--board">
                Board · Admin
              </NextLink>
            )}
            {user.channel ? (
              <span className="db-role-badge db-role-badge--artist">
                Artist
                {membershipInfo?.memberNumber ? ` · #${membershipInfo.memberNumber}` : ''}
              </span>
            ) : user.isMember ? (
              <span className="db-role-badge db-role-badge--member">
                Member{membershipInfo?.memberNumber ? ` #${membershipInfo.memberNumber}` : ''}
              </span>
            ) : (
              <span className="db-role-badge">Free listener</span>
            )}
            {otherModeratedChannels.length > 0 && (
              <span className="db-role-badge db-role-badge--moderator">
                Moderator · {otherModeratedChannels.length}
              </span>
            )}
          </div>
        </div>
        {user.channel ? (
          <div className="studio-page-header__actions">
            <NextLink href="/dashboard/broadcast" className={`db-go-live-btn${goLiveBtnClass}`}>
              <span className={headerDotClass} aria-hidden style={{ width: 6, height: 6 }} />
              {goLiveBtnLabel}
            </NextLink>
          </div>
        ) : (
          <div className="studio-page-header__actions">
            <NextLink
              href="/dashboard/setup-channel"
              className="db-go-live-btn db-go-live-btn--channel"
            >
              <SidebarNavIconSvg name="channel" />
              Design your artist channel
            </NextLink>
          </div>
        )}
      </div>

      <DashboardOverview
        channel={user.channel}
        liveBroadcastTitle={liveBroadcastTitle}
        username={user.username}
        isMember={user.isMember}
        memberNumber={membershipInfo?.memberNumber ?? null}
        broadcastUsage={broadcastUsage}
        weeklyListeners={weeklyListeners}
        statDlCount={statDlCount}
        revenueCents={fanPayoutStats.paidLast30Days}
        archiveItems={archiveItemsForEdit.map((item) => ({
          id: item.id,
          title: item.title,
          durationSec:
            typeof item.durationSec === 'number' || item.durationSec === null
              ? item.durationSec
              : undefined,
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
        }))}
        downloadGateSummary={downloadGateSummary}
        channelLiveStats={channelLiveStats}
        channelEgress={channelEgress}
        otherModeratedChannels={otherModeratedChannels}
      />
    </PageShell>
  )
}
