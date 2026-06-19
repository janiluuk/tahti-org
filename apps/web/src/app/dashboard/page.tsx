// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form'
import StreamSettingsPanel from './stream-settings'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'
import AnnouncementsPanel from './announcements-panel'
import ModeratorsPanel from './moderators-panel'
import type { ModeratorRow } from './moderator-actions'
import FanSubscriptionsPanel from './fan-subscriptions'
import NewsletterPanel from './newsletter-panel'
import ReleasesPanel from './releases-panel'
import CollectionsPanel from './collections-panel'
import ChannelGalleryPanel from './channel-gallery-panel'
import ChannelTextLayerPanel from './channel-text-layer-panel'
import ChannelVisualPresetPanel from './channel-visual-preset-panel'
import ProgrammePanel from './programme-panel'
import ChannelSchedulePanel from './channel-schedule-panel'
import type { ProgrammeItemRow } from './programme-actions'
import ArchiveEditor from './archive-editor'
import MembershipPanel from './membership-panel'
import PrivacyPanel from './privacy-panel'
import SocialPromoPanel from './social-promo-panel'
import type { SocialSettings } from './social-actions'
import { CustomDomainPanel } from './custom-domain-panel'
import { MixcloudConnect } from './mixcloud-connect'
import { fetchMixcloudStatus } from './mixcloud-actions'
import { TahtiRadioPanel } from './tahti-radio-panel'
import { MentionsPanel } from './mentions-panel'
import { Link, PageShell, Panel, StudioCollapse } from '@tahti/ui'
import { DashboardTabs } from './dashboard-tabs'
import { DashboardOverview } from './_dashboard-overview'
import { AccountSettings } from './_account-settings'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  CollectionGalleryMode,
  CollectionTextLayerAlignment,
  CollectionTextLayerMode,
  VisualPreset,
  SlideshowPreset,
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
  isMember: boolean
  isBoard: boolean
  membership: { status: string; activatedAt: string | null } | null
  channel: {
    slug: string
    state: string
    customDomain: string | null
    customDomainVerified: boolean
  } | null
  storage: { usedBytes: string; softTargetBytes?: string; showSoftTarget: boolean } | null
}

interface ModeratedChannel {
  slug: string
  displayName: string
  isOwner: boolean
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

  let channelVisual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  } | null = null
  if (user.channel) {
    try {
      const res = await fetch(`${apiUrl}/api/me/channel/visual`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) channelVisual = (await res.json()) as typeof channelVisual
    } catch {
      /* ignore */
    }
  }
  if (user.channel && !channelVisual) {
    channelVisual = {
      visualPreset: 'MINIMAL',
      colorSchemeJson: null,
      slideshowPreset: 'FADE',
      slideshowIntervalSeconds: 8,
      slideshowTransitionMs: 600,
      slideshowAutoplay: true,
    }
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
                <span
                  className={`db-header-channel-state${user.channel.state === 'LIVE' ? ' db-header-channel-state--live' : ''}`}
                >
                  <span
                    className={user.channel.state === 'LIVE' ? 'signal-dot' : 'db-offline-dot'}
                    aria-hidden
                  />
                  {user.channel.state === 'LIVE' ? 'broadcasting live' : 'offline'}
                </span>
                <span>·</span>
                <Link href={`/c/${user.channel.slug}`} className="db-header-channel-url">
                  {user.channel.slug}.tahti.live
                </Link>
              </>
            ) : (
              <span>{user.displayName}</span>
            )}
          </div>
          <div className="db-role-row" style={{ marginTop: '0.5rem' }}>
            {user.isBoard && (
              <Link href="/admin" className="db-role-badge db-role-badge--board">
                Board · Admin
              </Link>
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
        {user.channel && (
          <div className="studio-page-header__actions">
            <Link
              href={`/c/${user.channel.slug}`}
              className={`db-go-live-btn${user.channel.state === 'LIVE' ? ' db-go-live-btn--live' : ''}`}
            >
              <span
                className={user.channel.state === 'LIVE' ? 'signal-dot' : 'db-offline-dot'}
                aria-hidden
                style={{ width: 6, height: 6 }}
              />
              {user.channel.state === 'LIVE' ? 'On air' : 'Go live now'}
            </Link>
          </div>
        )}
      </div>

      <DashboardTabs
        hasChannel={!!user.channel}
        overview={
          <DashboardOverview
            channel={user.channel}
            streamSettings={streamSettings}
            broadcastUsage={broadcastUsage}
            statDlCount={statDlCount}
            statBroadcasts={statBroadcasts}
            fanSubscribers={newsletterStats.confirmed}
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
            storageBar={
              user.storage ? (
                <StorageBar
                  usedBytes={Number(user.storage.usedBytes)}
                  softTargetBytes={
                    user.storage.softTargetBytes ? Number(user.storage.softTargetBytes) : undefined
                  }
                  showSoftTarget={user.storage.showSoftTarget}
                />
              ) : null
            }
          />
        }
        broadcast={
          user.channel ? (
            <>
              {streamSettings && (
                <StreamSettingsPanel
                  initial={streamSettings}
                  isLive={user.channel.state === 'LIVE'}
                />
              )}

              {user.channel.state === 'LIVE' && (
                <Panel title="Live tracklist" headerTight>
                  <LiveTracklistPanel
                    slug={user.channel.slug}
                    heading="Detected tracks"
                    showPlaceholder
                  />
                </Panel>
              )}

              <StudioCollapse
                title="Channel appearance"
                hint="gallery, text overlay & visual style"
              >
                {channelGallery && <ChannelGalleryPanel initial={channelGallery} />}
                {channelTextLayer && <ChannelTextLayerPanel initial={channelTextLayer} />}
                {channelVisual && <ChannelVisualPresetPanel initial={channelVisual} />}
              </StudioCollapse>

              <StudioCollapse title="Schedule & programme" hint="next show & running order">
                {channelProgramme && <ProgrammePanel initial={channelProgramme} />}
                <ChannelSchedulePanel
                  initialAt={channelSchedule.nextBroadcastAt}
                  initialNote={channelSchedule.nextBroadcastNote}
                />
              </StudioCollapse>

              <Panel
                title="Multistream"
                headerTight
                description="Mirror your live broadcast to other platforms"
              >
                <p className="studio-text-muted-sm studio-mb-sm">
                  Manage RTMP targets, status, and stream keys on a dedicated page.
                </p>
                <Link
                  href="/dashboard/settings/multistream"
                  className="ui-btn ui-btn--sm ui-btn--secondary"
                >
                  Manage multistream targets →
                </Link>
              </Panel>

              <StudioCollapse
                title="Distribution & chat"
                hint="Mixcloud, Tahti Radio, announcements, mods"
              >
                <Suspense fallback={null}>
                  <MixcloudConnect
                    initial={{
                      connected: mixcloudStatus.connected,
                      configured: mixcloudStatus.configured,
                    }}
                    apiUrl={apiUrl}
                  />
                </Suspense>
                <TahtiRadioPanel />
                <AnnouncementsPanel initial={announcements} />
                <ModeratorsPanel initial={moderators} channelSlug={user.channel.slug} />
              </StudioCollapse>
            </>
          ) : undefined
        }
        catalog={
          user.channel ? (
            <>
              <ReleasesPanel initial={releases} username={user.username} />
              <CollectionsPanel
                initial={collections}
                username={user.username}
                apiUrl={apiUrl}
                archiveItems={archiveItems.map((a) => ({ id: a.id, title: a.title }))}
                publishedReleases={publishedReleases}
              />
              <section className="studio-archive-section">
                <Panel
                  title="Archive"
                  headerTight
                  description="Upload with genre, type, BPM, license, and access options."
                  flushTop
                >
                  <UploadForm />
                  {archiveItemsForEdit.length === 0 ? (
                    <div className="studio-empty-card studio-mt-sm studio-mb-0">
                      <p className="studio-empty-card__text">No archive items yet.</p>
                      <p className="studio-empty-card__hint">
                        Upload a set above — it will appear on your channel once published.
                      </p>
                    </div>
                  ) : (
                    <ul className="studio-list studio-mt-sm">
                      {archiveItemsForEdit.map((item) => {
                        const play = archiveItems.find((a) => a.id === item.id)
                        return (
                          <li key={item.id}>
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
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Panel>
              </section>
            </>
          ) : undefined
        }
        audience={
          user.channel ? (
            <>
              <FanSubscriptionsPanel
                initial={fanTiers}
                username={user.username}
                apiUrl={apiUrl}
                connect={fanConnect}
                payoutStats={fanPayoutStats}
              />
              <NewsletterPanel
                initialStats={newsletterStats}
                initialDrafts={newsletterDrafts}
                hasFanNewsletterPerk={hasFanNewsletterPerk}
                tier={user.tier}
                displayName={user.displayName}
              />
            </>
          ) : undefined
        }
        account={
          <AccountSettings
            email={user.email}
            username={user.username}
            membership={
              membershipInfo ? (
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
              ) : null
            }
            social={
              socialSettings ? <SocialPromoPanel initial={socialSettings} apiUrl={apiUrl} /> : null
            }
            mentions={<MentionsPanel />}
            domain={
              <CustomDomainPanel
                initialDomain={user.channel?.customDomain ?? null}
                initialVerified={user.channel?.customDomainVerified ?? false}
                isPaid={user.tier !== 'FREE'}
              />
            }
            privacy={<PrivacyPanel username={user.username} apiUrl={apiUrl} />}
          />
        }
      />
    </PageShell>
  )
}

function StorageBar({
  usedBytes,
  softTargetBytes,
  showSoftTarget,
}: {
  usedBytes: number
  softTargetBytes?: number
  showSoftTarget: boolean
}) {
  function fmtBytes(bytes: number): string {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
    return `${Math.max(1, Math.round(bytes / 1024))} KB`
  }

  if (!showSoftTarget || softTargetBytes == null) {
    return (
      <div className="studio-storage">
        <div className="studio-storage-header">
          <span className="studio-stat-box-title">Storage</span>
          <span className="studio-text-sm studio-text-muted-sm">{fmtBytes(usedBytes)} used</span>
        </div>
      </div>
    )
  }

  const pct = Math.min(100, Math.round((usedBytes / softTargetBytes) * 100))
  const isNearLimit = pct >= 80

  return (
    <div className="studio-storage">
      <div className="studio-storage-header">
        <span className="studio-stat-box-title">Storage</span>
        <span
          className={`studio-text-sm${isNearLimit ? ' studio-text-error' : ' studio-text-muted-sm'}`}
        >
          {fmtBytes(usedBytes)} · soft target {fmtBytes(softTargetBytes)}
        </span>
      </div>
      <div className="studio-storage-track">
        <div
          className={`studio-storage-fill${isNearLimit ? ' studio-storage-fill--warn' : ''}`}
          style={{ ['--studio-storage-pct' as string]: `${pct}%` }}
        />
      </div>
      {isNearLimit && (
        <p className="studio-text-muted-sm studio-mt-sm studio-m-0">
          You&apos;ve passed the soft target — that&apos;s fine. We track usage, not hard limits.
        </p>
      )}
    </div>
  )
}
