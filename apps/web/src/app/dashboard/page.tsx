// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UploadForm from './upload-form'
import StreamSettingsPanel from './stream-settings'
import RtmpTargetsPanel from './rtmp-targets'
import AnnouncementsPanel from './announcements-panel'
import FanSubscriptionsPanel from './fan-subscriptions'
import NewsletterPanel from './newsletter-panel'
import ReleasesPanel from './releases-panel'
import CollectionsPanel from './collections-panel'
import ChannelGalleryPanel from './channel-gallery-panel'
import ChannelTextLayerPanel from './channel-text-layer-panel'
import ArchiveEditor from './archive-editor'
import MembershipPanel from './membership-panel'
import BroadcastUsageBanner from './broadcast-usage'
import UpgradeCta from './upgrade-cta'
import { Button, Heading, Link, PageShell, Panel, Row, Text } from '@/components/ui'
import type {
  ChannelGalleryMode,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
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

  type MembershipInfo = {
    status: string
    isMember: boolean
    memberNumber: number | null
    priceCents: number
    emailVerified: boolean
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

  type BroadcastUsageInfo = {
    unlimited: boolean
    secondsUsed: number
    secondsRemaining: number | null
    warnings: number[]
    atCap: boolean
    inGrace?: boolean
    blocked?: boolean
    showUpgradeCta?: boolean
    weeklyCapSeconds: number
  }
  let broadcastUsage: BroadcastUsageInfo | null = null
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
  }

  let channelGallery: { galleryMode: ChannelGalleryMode; slideshowImages: string[] } | null = null
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

  return (
    <PageShell size="md" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      <Row between className="ui-row--gap-3">
        <Heading level={1}>Dashboard</Heading>
        <form action="/api/auth/logout" method="POST">
          <Button type="submit" variant="ghost">
            Log out
          </Button>
        </form>
      </Row>

      <Text tone="secondary" style={{ marginTop: '0.5rem' }}>
        Welcome back, {user.displayName} · <Link href="/governance">Member governance</Link>
      </Text>

      {membershipInfo && (
        <MembershipPanel
          status={membershipInfo.status}
          isMember={membershipInfo.isMember}
          memberNumber={membershipInfo.memberNumber}
          priceCents={membershipInfo.priceCents}
          emailVerified={membershipInfo.emailVerified}
        />
      )}

      {user.channel && (
        <Panel title="Your channel">
          <BroadcastUsageBanner usage={broadcastUsage} />
          <UpgradeCta show={!!broadcastUsage?.showUpgradeCta} />
          <Text size="sm" style={{ margin: '0.25rem 0' }}>
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

      {user.channel && streamSettings && <StreamSettingsPanel initial={streamSettings} />}

      {user.channel && channelGallery && <ChannelGalleryPanel initial={channelGallery} />}

      {user.channel && channelTextLayer && <ChannelTextLayerPanel initial={channelTextLayer} />}

      {user.channel && <RtmpTargetsPanel initial={rtmpTargets} />}

      {user.channel && <AnnouncementsPanel initial={announcements} />}

      {user.channel && (
        <FanSubscriptionsPanel initial={fanTiers} username={user.username} connect={fanConnect} />
      )}

      {user.channel && (
        <NewsletterPanel
          initialStats={newsletterStats}
          initialDrafts={newsletterDrafts}
          hasFanNewsletterPerk={hasFanNewsletterPerk}
          tier={user.tier}
        />
      )}

      {user.channel && <ReleasesPanel initial={releases} username={user.username} />}

      {user.channel && (
        <CollectionsPanel
          initial={collections}
          username={user.username}
          archiveItems={archiveItems.map((a) => ({ id: a.id, title: a.title }))}
          publishedReleases={publishedReleases}
        />
      )}

      {user.channel && (
        <section
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            border: '1px solid #eee',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: '0 0 1rem' }}>Archive</h2>
          <p style={{ color: '#666', fontSize: '0.875rem', margin: '0 0 0.5rem' }}>
            Upload with genre, type, BPM, license, and access options — like hearthis.at edit
            upload.
          </p>

          <UploadForm />

          {archiveItemsForEdit.length === 0 ? (
            <p style={{ color: '#999', marginTop: '1.5rem' }}>No archive items yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.5rem' }}>
              {archiveItemsForEdit.map((item) => {
                const play = archiveItems.find((a) => a.id === item.id)
                return (
                  <div key={item.id}>
                    <ArchiveEditor item={item} />
                    {play?.audioUrl && (
                      <audio
                        controls
                        src={play.audioUrl}
                        style={{ margin: '0 0 0.75rem', width: '100%' }}
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
    <div
      style={{
        marginTop: '2rem',
        padding: '1rem 1.5rem',
        border: '1px solid #eee',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Storage</span>
        <span style={{ fontSize: '0.875rem', color: isNearLimit ? '#dc2626' : '#666' }}>
          {fmt(usedMB)} / {fmt(targetMB)}
        </span>
      </div>
      <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: isNearLimit ? '#dc2626' : '#2563eb',
            borderRadius: 4,
            transition: 'width 0.3s',
          }}
        />
      </div>
      {isNearLimit && (
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#dc2626' }}>
          You&apos;re approaching your soft storage target. Contact us if you need more space.
        </p>
      )}
    </div>
  )
}
