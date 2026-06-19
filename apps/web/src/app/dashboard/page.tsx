// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
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
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'

const ArchiveEditor = dynamic(() => import('./archive-editor'))

interface StreamSettings {
  rtmp: { server: string; streamKey: string }
  icecast: { server: string; mount: string; password: string }
  hlsUrl: string
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

  let streamSettings: StreamSettings | null = null
  let announcements: Array<{ id: string; body: string; createdAt: string }> = []
  let moderators: ModeratorRow[] = []
  let moderatedChannels: ModeratedChannel[] = []
  let membershipInfo: MembershipInfo | null = null
  let socialSettings: SocialSettings | null = null
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
  let fanTiers: Array<{
    id: string
    name: string
    amountCents: number
    description: string | null
    perks: string[]
    active: boolean
  }> = []
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
  let channelGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  } | null = null
  let channelTextLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  } | null = null
  let channelVisual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  } | null = null
  let channelProgramme: { fallbackMode: 'shuffle' | 'ordered'; items: ProgrammeItemRow[] } | null =
    null
  let archiveItems: ArchiveItem[] = []
  let archiveItemsForEdit: Array<
    Record<string, unknown> & { id: string; title: string; status: string }
  > = []
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
  let channelSchedule: { nextBroadcastAt: string | null; nextBroadcastNote: string | null } = {
    nextBroadcastAt: null,
    nextBroadcastNote: null,
  }

  try {
    const [
      streamSettingsRes,
      announcementsRes,
      moderatorsRes,
      moderatedRes,
      membershipRes,
      socialRes,
      broadcastUsageRes,
      funnelRes,
      releasesRes,
      fanTiersRes,
      fanConnectRes,
      fanPayoutsRes,
      galleryRes,
      textLayerRes,
      visualRes,
      programmeRes,
      channelItemsRes,
      archiveRes,
      collectionsRes,
      scheduleRes,
      newsletterPair,
    ] = await Promise.all([
      slug ? get('/api/me/stream-settings') : null,
      slug ? fetch(`${apiUrl}/api/chat/${slug}/announcements`, { cache: 'no-store' }) : null,
      slug ? get('/api/me/channel/moderators') : null,
      get('/api/me/moderate'),
      get('/api/me/membership'),
      get('/api/me/social'),
      slug ? get('/api/me/broadcast-usage') : null,
      slug ? get('/api/me/channel-funnel-stats') : null,
      get('/api/me/releases'),
      slug ? get('/api/me/fan-tiers') : null,
      slug ? get('/api/me/fan-subs/connect') : null,
      slug ? get('/api/me/fan-sub-payouts') : null,
      slug ? get('/api/me/channel/gallery') : null,
      slug ? get('/api/me/channel/text-layer') : null,
      slug ? get('/api/me/channel/visual') : null,
      slug ? get('/api/me/channel/programme') : null,
      slug ? fetch(`${apiUrl}/api/channels/${slug}/items`, { cache: 'no-store' }) : null,
      slug ? get('/api/me/archive') : null,
      get('/api/me/collections?expand=items'),
      slug ? get('/api/me/channel/schedule') : null,
      slug
        ? Promise.all([get('/api/me/newsletter/subscribers'), get('/api/me/newsletter/drafts')])
        : null,
    ])

    if (streamSettingsRes?.ok) streamSettings = (await streamSettingsRes.json()) as StreamSettings
    if (announcementsRes?.ok) {
      announcements = (await announcementsRes.json()) as typeof announcements
    }
    if (moderatorsRes?.ok) moderators = (await moderatorsRes.json()) as ModeratorRow[]
    if (moderatedRes.ok) moderatedChannels = (await moderatedRes.json()) as ModeratedChannel[]
    if (membershipRes.ok) membershipInfo = (await membershipRes.json()) as MembershipInfo
    if (socialRes.ok) socialSettings = (await socialRes.json()) as SocialSettings
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
    if (releasesRes.ok) releases = (await releasesRes.json()) as typeof releases
    if (fanTiersRes?.ok) fanTiers = (await fanTiersRes.json()) as typeof fanTiers
    if (fanConnectRes?.ok) fanConnect = (await fanConnectRes.json()) as typeof fanConnect
    if (fanPayoutsRes?.ok) fanPayoutStats = (await fanPayoutsRes.json()) as typeof fanPayoutStats
    if (galleryRes?.ok) channelGallery = (await galleryRes.json()) as typeof channelGallery
    if (textLayerRes?.ok) channelTextLayer = (await textLayerRes.json()) as typeof channelTextLayer
    if (visualRes?.ok) channelVisual = (await visualRes.json()) as typeof channelVisual
    if (programmeRes?.ok) channelProgramme = (await programmeRes.json()) as typeof channelProgramme
    if (channelItemsRes?.ok) archiveItems = (await channelItemsRes.json()) as ArchiveItem[]
    if (archiveRes?.ok) {
      archiveItemsForEdit = (await archiveRes.json()) as typeof archiveItemsForEdit
    }
    if (collectionsRes.ok) collections = (await collectionsRes.json()) as typeof collections
    if (scheduleRes?.ok) channelSchedule = (await scheduleRes.json()) as typeof channelSchedule
    if (newsletterPair) {
      const [statsRes, draftsRes] = newsletterPair
      if (statsRes.ok) newsletterStats = (await statsRes.json()) as NewsletterStats
      if (draftsRes.ok) newsletterDrafts = (await draftsRes.json()) as NewsletterDraft[]
    }
  } catch {
    // ignore — dashboard renders with partial data
  }

  const otherModeratedChannels = moderatedChannels.filter((c) => !c.isOwner)

  if (user.channel && !channelGallery) {
    channelGallery = { galleryMode: 'NONE', slideshowImages: [] }
  }
  if (user.channel && !channelTextLayer) {
    channelTextLayer = { textLayerMode: 'NONE', textLayerText: '', textLayerAlign: 'CENTER' }
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
  if (user.channel && !channelProgramme) {
    channelProgramme = { fallbackMode: 'shuffle', items: [] }
  }

  const publishedReleases = releases
    .filter((r) => r.state === 'PUBLISHED')
    .map((r) => ({ id: r.id, title: r.title }))

  const hasFanNewsletterPerk = fanTiers.some(
    (t) => t.active && t.perks.some((p) => p === 'FAN_NEWSLETTER'),
  )

  const mixcloudStatus = await fetchMixcloudStatus()

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
            <section id="broadcast" className="studio-section-anchor">
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

              <div id="channel-appearance" className="studio-section-anchor">
                <StudioCollapse
                  title="Channel appearance"
                  hint="gallery, text overlay & visual style"
                  defaultOpen
                >
                  {channelGallery && <ChannelGalleryPanel initial={channelGallery} />}
                  {channelTextLayer && <ChannelTextLayerPanel initial={channelTextLayer} />}
                  {channelVisual && (
                    <ChannelVisualPresetPanel
                      channelSlug={user.channel.slug}
                      initial={channelVisual}
                    />
                  )}
                </StudioCollapse>
              </div>

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
            </section>
          ) : undefined
        }
        catalog={
          user.channel ? (
            <>
              <section id="releases" className="studio-catalog-section studio-section-anchor">
                <ReleasesPanel initial={releases} username={user.username} />
              </section>
              <section id="collections" className="studio-catalog-section studio-section-anchor">
                <CollectionsPanel
                  initial={collections}
                  username={user.username}
                  apiUrl={apiUrl}
                  archiveItems={archiveItems.map((a) => ({ id: a.id, title: a.title }))}
                  publishedReleases={publishedReleases}
                />
              </section>
              <section id="archive" className="studio-catalog-section studio-section-anchor">
                <Panel
                  title="Archive"
                  headerTight
                  description="Upload with genre, type, BPM, license, and access options."
                  className="import-page__panel"
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
            <section id="newsletter" className="studio-section-anchor">
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
            </section>
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
