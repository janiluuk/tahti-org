// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form'
import StreamSettingsPanel from './stream-settings'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import RtmpTargetsPanel from './rtmp-targets'
import AnnouncementsPanel from './announcements-panel'
import ModeratorsPanel from './moderators-panel'
import type { ModeratorRow } from './moderator-actions'
import FanSubscriptionsPanel from './fan-subscriptions'
import NewsletterPanel from './newsletter-panel'
import ReleasesPanel from './releases-panel'
import CollectionsPanel from './collections-panel'
import ChannelGalleryPanel from './channel-gallery-panel'
import ChannelTextLayerPanel from './channel-text-layer-panel'
import ProgrammePanel from './programme-panel'
import ChannelSchedulePanel from './channel-schedule-panel'
import type { ProgrammeItemRow } from './programme-actions'
import ArchiveEditor from './archive-editor'
import MembershipPanel from './membership-panel'
import PrivacyPanel from './privacy-panel'
import SocialPromoPanel from './social-promo-panel'
import type { SocialSettings } from './social-actions'
import BroadcastUsageBanner from './broadcast-usage'
import { DownloadGateSummaryPanel } from './download-gate-summary'
import { ChannelEgressPanel } from './channel-egress-panel'
import { ChannelLiveStatsPanel } from './channel-live-stats-panel'
import UpgradeCta from './upgrade-cta'
import { MixcloudConnect } from './mixcloud-connect'
import { fetchMixcloudStatus } from './mixcloud-actions'
import { EndBroadcastBtn } from './end-broadcast-btn'
import { Heading, Link, PageShell, Panel, Text } from '@tahti/ui'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  CollectionGalleryMode,
  CollectionTextLayerAlignment,
  CollectionTextLayerMode,
} from '@tahti/shared'

interface StreamSettings {
  rtmp: { server: string; streamKey: string }
  icecast: { server: string; mount: string; password: string }
  hlsUrl: string
}

interface MeResponse {
  id: string
  email: string
  username: string
  displayName: string
  tier: string
  emailVerifiedAt: string | null
  membership: { status: string; activatedAt: string | null } | null
  channel: { slug: string; state: string } | null
  storage: { usedBytes: string; softTargetBytes: string } | null
}

interface ModeratedChannel {
  slug: string
  displayName: string
  isOwner: boolean
}

interface RtmpTarget {
  id: string
  provider: string
  label: string
  rtmpUrl: string
  alwaysMirror: boolean
  enabled: boolean
}

interface ArchiveItem {
  id: string
  title: string
  description: string | null
  durationSec: number | null
  audioUrl: string | null
  createdAt: string
}

export default async function DashboardPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')

  if (!sessionCookie) {
    redirect('/login')
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  let user: MeResponse
  try {
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!response.ok) {
      redirect('/login')
    }
    user = (await response.json()) as MeResponse
  } catch {
    redirect('/login')
  }

  let streamSettings: StreamSettings | null = null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/stream-settings`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        streamSettings = (await res.json()) as StreamSettings
      }
    } catch {
      // ignore
    }
  }

  let rtmpTargets: RtmpTarget[] = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/rtmp-targets`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) rtmpTargets = (await res.json()) as RtmpTarget[]
    } catch {
      /* ignore */
    }
  }

  let announcements: Array<{ id: string; body: string; createdAt: string }> = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/chat/${user.channel.slug}/announcements`, {
        cache: 'no-store',
      })
      if (res.ok) {
        announcements = (await res.json()) as typeof announcements
      }
    } catch {
      // ignore
    }
  }

  let moderators: ModeratorRow[] = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/moderators`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) moderators = (await res.json()) as ModeratorRow[]
    } catch {
      // ignore
    }
  }

  let moderatedChannels: ModeratedChannel[] = []
  try {
    const res = await fetch(`${apiUrl}/api/me/moderate`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.ok) moderatedChannels = (await res.json()) as ModeratedChannel[]
  } catch {
    // ignore
  }
  const otherModeratedChannels = moderatedChannels.filter((c) => !c.isOwner)

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
  let membershipInfo: MembershipInfo | null = null
  try {
    const res = await fetch(`${apiUrl}/api/me/membership`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.ok) membershipInfo = (await res.json()) as MembershipInfo
  } catch {
    // ignore
  }

  let socialSettings: SocialSettings | null = null
  try {
    const res = await fetch(`${apiUrl}/api/me/social`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.ok) socialSettings = (await res.json()) as SocialSettings
  } catch {
    // ignore
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
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/broadcast-usage`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) broadcastUsage = (await res.json()) as BroadcastUsageInfo
    } catch {
      // ignore
    }
    try {
      const res = await fetch(`${apiUrl}/api/me/channel-funnel-stats`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const funnel = (await res.json()) as {
          downloadGates: NonNullable<typeof downloadGateSummary>
          live: NonNullable<typeof channelLiveStats>
          egress: NonNullable<typeof channelEgress>
        }
        downloadGateSummary = funnel.downloadGates
        channelLiveStats = funnel.live
        channelEgress = funnel.egress
      }
    } catch {
      // ignore
    }
  }

  let releases: Array<{
    id: string
    title: string
    type: string
    state: string
    releaseDate: string
    smartLinkSlug: string
    smartLinkTargets: Record<string, string> | null
    _count: { tracks: number }
  }> = []
  try {
    const res = await fetch(`${apiUrl}/api/me/releases`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.ok) releases = (await res.json()) as typeof releases
  } catch {
    // ignore
  }

  let fanTiers: Array<{
    id: string
    name: string
    amountCents: number
    description: string | null
    perks: string[]
    active: boolean
  }> = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/fan-tiers`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) fanTiers = (await res.json()) as typeof fanTiers
    } catch {
      // ignore
    }
  }

  let fanConnect: {
    stripeConfigured: boolean
    paymentsReady: boolean
    chargesEnabled: boolean
    detailsSubmitted: boolean
  } = {
    stripeConfigured: false,
    paymentsReady: true,
    chargesEnabled: true,
    detailsSubmitted: true,
  }
  let fanPayoutStats = { pending: 0, failed: 0, paidLast30Days: 0 }
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/fan-subs/connect`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) fanConnect = (await res.json()) as typeof fanConnect
    } catch {
      // ignore
    }
    try {
      const res = await fetch(`${apiUrl}/api/me/fan-sub-payouts`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) fanPayoutStats = (await res.json()) as typeof fanPayoutStats
    } catch {
      // ignore
    }
  }

  let channelGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  } | null = null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/gallery`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        channelGallery = (await res.json()) as typeof channelGallery
      }
    } catch {
      // ignore
    }
  }
  if (user.channel && !channelGallery) {
    channelGallery = { galleryMode: 'NONE', slideshowImages: [] }
  }

  let channelTextLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  } | null = null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/text-layer`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        channelTextLayer = (await res.json()) as typeof channelTextLayer
      }
    } catch {
      // ignore
    }
  }
  if (user.channel && !channelTextLayer) {
    channelTextLayer = { textLayerMode: 'NONE', textLayerText: '', textLayerAlign: 'CENTER' }
  }

  let channelProgramme: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] } | null =
    null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/programme`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        channelProgramme = (await res.json()) as typeof channelProgramme
      }
    } catch {
      // ignore
    }
  }
  if (user.channel && !channelProgramme) {
    channelProgramme = { fallbackMode: 'shuffle', items: [] }
  }

  let archiveItems: ArchiveItem[] = []
  let archiveItemsForEdit: Array<
    Record<string, unknown> & { id: string; title: string; status: string }
  > = []
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/channels/${user.channel.slug}/items`, {
        cache: 'no-store',
      })
      if (res.ok) {
        archiveItems = (await res.json()) as ArchiveItem[]
      }
    } catch {
      // ignore — items section just shows empty
    }
    try {
      const res = await fetch(`${apiUrl}/api/me/archive`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        archiveItemsForEdit = (await res.json()) as typeof archiveItemsForEdit
      }
    } catch {
      // ignore
    }
  }

  let collections: Array<{
    id: string
    slug: string
    name: string
    type: string
    isPublic: boolean
    coverUrl?: string | null
    galleryMode?: CollectionGalleryMode
    slideshowImages?: string[]
    videoBackgroundUrl?: string | null
    textLayerMode?: CollectionTextLayerMode
    textLayerText?: string
    textLayerAlign?: CollectionTextLayerAlignment
    _count?: { items: number }
    items?: Array<{
      id: string
      position: number
      archiveItem: { id: string; title: string } | null
      release: { id: string; title: string } | null
    }>
  }> = []
  try {
    const res = await fetch(`${apiUrl}/api/me/collections?expand=items`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (res.ok) collections = (await res.json()) as typeof collections
  } catch {
    // ignore
  }

  const publishedReleases = releases
    .filter((r) => r.state === 'PUBLISHED')
    .map((r) => ({ id: r.id, title: r.title }))

  type NewsletterStats = { total: number; confirmed: number; newLast30Days: number }
  type NewsletterDraft = {
    id: string
    subject: string
    state: string
    sentAt: string | null
    createdAt: string
    subscribersOnly: boolean
    _count: { sends: number }
  }
  let newsletterStats: NewsletterStats = { total: 0, confirmed: 0, newLast30Days: 0 }
  let newsletterDrafts: NewsletterDraft[] = []
  if (user.channel) {
    try {
      const [statsRes, draftsRes] = await Promise.all([
        fetch(`${apiUrl}/api/me/newsletter/subscribers`, {
          headers: { Cookie: `tahti_session=${sessionCookie.value}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/api/me/newsletter/drafts`, {
          headers: { Cookie: `tahti_session=${sessionCookie.value}` },
          cache: 'no-store',
        }),
      ])
      if (statsRes.ok) newsletterStats = (await statsRes.json()) as NewsletterStats
      if (draftsRes.ok) newsletterDrafts = (await draftsRes.json()) as NewsletterDraft[]
    } catch {
      // ignore
    }
  }

  const hasFanNewsletterPerk = fanTiers.some(
    (t) => t.active && t.perks.some((p) => p === 'FAN_NEWSLETTER'),
  )

  const mixcloudStatus = await fetchMixcloudStatus()

  let channelSchedule: { nextBroadcastAt: string | null; nextBroadcastNote: string | null } = {
    nextBroadcastAt: null,
    nextBroadcastNote: null,
  }
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/schedule`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) channelSchedule = (await res.json()) as typeof channelSchedule
    } catch {
      // ignore
    }
  }

  const statDlCount =
    (downloadGateSummary as { totals: { countedDownloads?: number } } | null)?.totals
      .countedDownloads ?? 0
  const statBroadcasts =
    (channelLiveStats as { totalBroadcasts: number } | null)?.totalBroadcasts ?? 0

  return (
    <PageShell size="md">
      <div id="studio-overview" className="studio-section-anchor studio-page-header">
        <div>
          <Heading level={1}>Dashboard</Heading>
          {user.channel && (
            <div className="db-header-channel-row">
              <span
                className={`db-header-channel-state${user.channel.state === 'LIVE' ? ' db-header-channel-state--live' : ''}`}
              >
                <span
                  className={user.channel.state === 'LIVE' ? 'signal-dot' : 'db-offline-dot'}
                  aria-hidden
                />
                {user.channel.state === 'LIVE' ? 'Live' : 'Offline'}
              </span>
              <Link href={`/c/${user.channel.slug}`} className="db-header-channel-url">
                {user.channel.slug}.tahti.live
              </Link>
            </div>
          )}
        </div>
        <Text tone="secondary" className="studio-mt-sm db-header-welcome">
          Welcome back, {user.displayName}
        </Text>
      </div>

      {otherModeratedChannels.length > 0 && (
        <div className="studio-panel-section">
          <h2 className="studio-section-heading">Channels you moderate</h2>
          <p className="studio-help">
            An artist has trusted you to moderate their chat. Manage bans without access to their
            dashboard.
          </p>
          <ul className="studio-list studio-mt-sm">
            {otherModeratedChannels.map((c) => (
              <li key={c.slug} className="studio-item-row--list">
                <span className="studio-flex-1">{c.displayName}</span>
                <Link href={`/dashboard/moderate/${c.slug}`} className="studio-btn-ghost">
                  Moderate chat
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {user.channel?.state === 'LIVE' && (
        <div className="db-status-bar" role="status">
          <div>
            <div className="db-live">
              <span className="signal-dot" aria-hidden />
              LIVE NOW
            </div>
            <div className="db-live-count">
              <Link href={`/c/${user.channel.slug}`}>View channel →</Link>
            </div>
          </div>
          <EndBroadcastBtn />
        </div>
      )}

      {user.channel && (
        <div className="db-stat-tiles">
          <div className="db-stat-tile db-stat-tile--amber">
            <span className="db-stat-tile-value">{statDlCount + statBroadcasts}</span>
            <span className="db-stat-tile-label">Archive plays</span>
          </div>
          <div className="db-stat-tile db-stat-tile--cyan">
            <span className="db-stat-tile-value">{statDlCount}</span>
            <span className="db-stat-tile-label">Downloads</span>
          </div>
          <div className="db-stat-tile db-stat-tile--purple">
            <span className="db-stat-tile-value">{newsletterStats.confirmed}</span>
            <span className="db-stat-tile-label">Subscribers</span>
          </div>
          <div className="db-stat-tile db-stat-tile--cyan">
            <span className="db-stat-tile-value">
              €{(fanPayoutStats.paidLast30Days / 100).toFixed(0)}
            </span>
            <span className="db-stat-tile-label">Revenue / mo</span>
          </div>
        </div>
      )}

      {user.channel && (
        <div className="db-quick-actions" aria-label="Quick actions">
          <Link href="#studio-releases" className="db-quick-action">
            Upload release
          </Link>
          <Link href="#studio-newsletter" className="db-quick-action">
            Send newsletter
          </Link>
          <Link href="#studio-distribution" className="db-quick-action">
            Push to Mixcloud
          </Link>
          <Link href="/dashboard/stats" className="db-quick-action">
            View stats
          </Link>
        </div>
      )}

      {membershipInfo && (
        <MembershipPanel
          status={membershipInfo.status}
          isMember={membershipInfo.isMember}
          memberNumber={membershipInfo.memberNumber}
          priceCents={membershipInfo.priceCents}
          emailVerified={membershipInfo.emailVerified}
          hasStripeSubscription={membershipInfo.hasStripeSubscription}
          renewalDueAt={membershipInfo.renewalDueAt}
          subscriptionMigrationRequired={membershipInfo.subscriptionMigrationRequired}
        />
      )}

      {socialSettings && <SocialPromoPanel initial={socialSettings} apiUrl={apiUrl} />}

      <PrivacyPanel username={user.username} apiUrl={apiUrl} />

      {user.channel && (
        <Panel title="Your channel">
          <BroadcastUsageBanner usage={broadcastUsage} />
          <UpgradeCta show={!!broadcastUsage?.showUpgradeCta} />
          <div id="studio-stats" className="studio-section-anchor">
            <DownloadGateSummaryPanel summary={downloadGateSummary} />
            <ChannelLiveStatsPanel stats={channelLiveStats} />
            <ChannelEgressPanel stats={channelEgress} />
          </div>
          <Text size="sm" className="studio-my-xs">
            <strong>URL:</strong>{' '}
            <Link href={`/c/${user.channel.slug}`}>
              <code>{user.channel.slug}.tahti.live</code>
            </Link>
          </Text>
          <Text size="sm" tone={user.channel.state === 'LIVE' ? 'success' : 'muted'}>
            <strong>Status:</strong> {user.channel.state === 'LIVE' ? 'Live' : 'Offline'}
          </Text>
        </Panel>
      )}

      {user.storage && (
        <StorageBar
          usedBytes={Number(user.storage.usedBytes)}
          softTargetBytes={Number(user.storage.softTargetBytes)}
        />
      )}

      <div id="studio-settings" className="studio-section-anchor">
        {user.channel && streamSettings && (
          <StreamSettingsPanel initial={streamSettings} isLive={user.channel.state === 'LIVE'} />
        )}

        {user.channel?.state === 'LIVE' && (
          <Panel title="Live tracklist">
            <LiveTracklistPanel
              slug={user.channel.slug}
              heading="Detected tracks"
              showPlaceholder
            />
          </Panel>
        )}

        {user.channel && channelGallery && <ChannelGalleryPanel initial={channelGallery} />}

        {user.channel && channelTextLayer && <ChannelTextLayerPanel initial={channelTextLayer} />}

        {user.channel && channelProgramme && <ProgrammePanel initial={channelProgramme} />}

        {user.channel && (
          <ChannelSchedulePanel
            initialAt={channelSchedule.nextBroadcastAt}
            initialNote={channelSchedule.nextBroadcastNote}
          />
        )}

        {user.channel && <RtmpTargetsPanel initial={rtmpTargets} />}
      </div>

      <div id="studio-distribution" className="studio-section-anchor">
        {user.channel && (
          <Suspense fallback={null}>
            <MixcloudConnect
              initial={{
                connected: mixcloudStatus.connected,
                configured: mixcloudStatus.configured,
              }}
              apiUrl={apiUrl}
            />
          </Suspense>
        )}

        {user.channel && <AnnouncementsPanel initial={announcements} />}

        {user.channel && <ModeratorsPanel initial={moderators} channelSlug={user.channel.slug} />}
      </div>

      <div id="studio-fans" className="studio-section-anchor">
        {user.channel && (
          <FanSubscriptionsPanel
            initial={fanTiers}
            username={user.username}
            apiUrl={apiUrl}
            connect={fanConnect}
            payoutStats={fanPayoutStats}
          />
        )}
      </div>

      <div id="studio-newsletter" className="studio-section-anchor">
        {user.channel && (
          <NewsletterPanel
            initialStats={newsletterStats}
            initialDrafts={newsletterDrafts}
            hasFanNewsletterPerk={hasFanNewsletterPerk}
            tier={user.tier}
          />
        )}
      </div>

      <div id="studio-releases" className="studio-section-anchor">
        {user.channel && <ReleasesPanel initial={releases} username={user.username} />}

        {user.channel && (
          <CollectionsPanel
            initial={collections}
            username={user.username}
            apiUrl={apiUrl}
            archiveItems={archiveItems.map((a) => ({ id: a.id, title: a.title }))}
            publishedReleases={publishedReleases}
          />
        )}
      </div>

      {user.channel && (
        <section id="studio-archive" className="studio-section-anchor studio-archive-section">
          <h2>Archive</h2>
          <p className="studio-text-muted-sm studio-text-sm studio-m-0 studio-mb-sm">
            Upload with genre, type, BPM, license, and access options — like hearthis.at edit
            upload.
          </p>

          <UploadForm />

          {archiveItemsForEdit.length === 0 ? (
            <p className="studio-empty studio-mt-xl studio-mb-0">No archive items yet.</p>
          ) : (
            <ul className="studio-list studio-mt-xl">
              {archiveItemsForEdit.map((item) => {
                const play = archiveItems.find((a) => a.id === item.id)
                return (
                  <div key={item.id}>
                    <ArchiveEditor
                      item={item}
                      mixcloudConnected={mixcloudStatus.connected}
                      mixcloudConfigured={mixcloudStatus.configured}
                      apiUrl={apiUrl}
                    />
                    {play?.audioUrl && (
                      <audio
                        controls
                        src={play.audioUrl}
                        className="studio-audio-full"
                        data-testid="dashboard-archive-player"
                      />
                    )}
                  </div>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </PageShell>
  )
}

function StorageBar({
  usedBytes,
  softTargetBytes,
}: {
  usedBytes: number
  softTargetBytes: number
}) {
  const usedMB = usedBytes / (1024 * 1024)
  const targetMB = softTargetBytes / (1024 * 1024)
  const pct = Math.min(100, Math.round((usedBytes / softTargetBytes) * 100))
  const isNearLimit = pct >= 80

  function fmt(mb: number): string {
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
  }

  return (
    <div className="studio-storage">
      <div className="studio-storage-header">
        <span className="studio-stat-box-title">Storage</span>
        <span
          className={`studio-text-sm${isNearLimit ? ' studio-text-error' : ' studio-text-muted-sm'}`}
        >
          {fmt(usedMB)} / {fmt(targetMB)}
        </span>
      </div>
      <div className="studio-storage-track">
        <div
          className={`studio-storage-fill${isNearLimit ? ' studio-storage-fill--warn' : ''}`}
          style={{ ['--studio-storage-pct' as string]: `${pct}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="studio-text-error studio-mt-sm studio-m-0">
          You&apos;re approaching your soft storage target. Contact us if you need more space.
        </p>
      )}
    </div>
  )
}
