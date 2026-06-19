// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ComponentProps, ReactNode } from 'react'
import {
  Link,
  StatCard,
  StatCardGrid,
  StudioCollapse,
  BroadcastStatusBar,
  SidebarNavIconSvg,
} from '@tahti/ui'
import BroadcastUsageBanner, { type BroadcastUsage } from './broadcast-usage'
import UpgradeCta from './upgrade-cta'
import { OverviewStreamKey } from './overview-stream-key'
import { EndBroadcastBtn } from './end-broadcast-btn'
import { DownloadGateSummaryPanel } from './download-gate-summary'
import { ChannelLiveStatsPanel } from './channel-live-stats-panel'
import { ChannelEgressPanel } from './channel-egress-panel'

interface StreamSettings {
  rtmp: { streamKey: string }
  icecast: { mount: string; password: string }
}

interface ArchiveItem {
  id: string
  title: string
  durationSec?: number | null
  createdAt?: string
}

interface ModeratedChannel {
  slug: string
  displayName: string
}

export type DashboardOverviewProps = {
  channel: { slug: string; state: string } | null
  streamSettings: StreamSettings | null
  broadcastUsage: BroadcastUsage | null
  statDlCount: number
  statBroadcasts: number
  fanSubscribers: number
  revenueCents: number
  archiveItems: ArchiveItem[]
  downloadGateSummary: ComponentProps<typeof DownloadGateSummaryPanel>['summary']
  channelLiveStats: ComponentProps<typeof ChannelLiveStatsPanel>['stats']
  channelEgress: ComponentProps<typeof ChannelEgressPanel>['stats']
  otherModeratedChannels: ModeratedChannel[]
  storageBar: ReactNode
}

function IconGuide() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 3.5c1.5-.7 3.3-.7 6 0v9c-2.7-.7-4.5-.7-6 0v-9ZM14 3.5c-1.5-.7-3.3-.7-6 0v9c2.7-.7 4.5-.7 6 0v-9Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="9" width="3" height="5" rx="0.75" fill="currentColor" opacity=".6" />
      <rect x="6.5" y="5" width="3" height="9" rx="0.75" fill="currentColor" opacity=".8" />
      <rect x="11" y="2" width="3" height="12" rx="0.75" fill="currentColor" />
    </svg>
  )
}

function IconView() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8s-2.3 4.5-6.5 4.5S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function agoLabel(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime()
  const d = Math.floor(ms / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return '1 day ago'
  if (d < 30) return `${d} days ago`
  return `${Math.floor(d / 30)} mo ago`
}

/** Channel overview — stats, credentials, quick actions, recent archive (matches website mock). */
export function DashboardOverview({
  channel,
  streamSettings,
  broadcastUsage,
  statDlCount,
  statBroadcasts,
  fanSubscribers,
  revenueCents,
  archiveItems,
  downloadGateSummary,
  channelLiveStats,
  channelEgress,
  otherModeratedChannels,
  storageBar,
}: DashboardOverviewProps) {
  if (!channel) {
    return (
      <div className="db-overview">
        {storageBar}
        <div className="studio-empty-card">
          <p className="studio-empty-card__text">No artist channel yet</p>
          <p className="studio-empty-card__hint">
            Complete membership and channel setup to unlock broadcasting, archive uploads, and fan
            subscriptions.
          </p>
          <div className="db-quick-actions db-quick-actions--centered">
            <Link
              href="/dashboard/setup-channel"
              className="db-quick-action db-quick-action--primary"
            >
              <SidebarNavIconSvg name="channel" />
              Design your artist channel
            </Link>
            <Link href="/for-artists" className="db-quick-action">
              <IconGuide />
              Artist guide
            </Link>
          </div>
        </div>
        {otherModeratedChannels.length > 0 && (
          <ModerationAccess channels={otherModeratedChannels} />
        )}
      </div>
    )
  }

  const isLive = channel.state === 'LIVE'

  return (
    <div className="db-overview">
      {isLive ? (
        <BroadcastStatusBar
          state="live"
          meta={<Link href={`/c/${channel.slug}`}>View channel →</Link>}
          action={<EndBroadcastBtn />}
        />
      ) : (
        <BroadcastStatusBar
          state="offline"
          offlineMessage="Channel offline — connect OBS or Icecast to go live"
          meta={
            <Link href="/dashboard#broadcast" className="db-overview-broadcast-link">
              Stream settings →
            </Link>
          }
        />
      )}

      <StatCardGrid aria-label="Channel summary">
        <StatCard
          variant="plays"
          value={(statDlCount + statBroadcasts).toLocaleString()}
          label="Plays this month"
        />
        <StatCard variant="downloads" value={statDlCount.toLocaleString()} label="Downloads" />
        <StatCard variant="fans" value={fanSubscribers.toLocaleString()} label="Fan subscribers" />
        <StatCard
          variant="revenue"
          value={`€${(revenueCents / 100).toFixed(0)}`}
          label="Revenue this month"
        />
      </StatCardGrid>

      <BroadcastUsageBanner usage={broadcastUsage} />
      <UpgradeCta show={!!broadcastUsage?.showUpgradeCta} />

      {streamSettings ? (
        <OverviewStreamKey
          rtmpKey={streamSettings.rtmp.streamKey}
          icecastMount={streamSettings.icecast.mount}
          icecastPass={streamSettings.icecast.password}
        />
      ) : (
        <div className="db-stream-panel db-stream-panel--placeholder">
          <div className="db-stream-panel__label">Stream credentials</div>
          <p className="studio-text-muted-sm studio-m-0">
            Could not load stream keys.{' '}
            <Link href="/dashboard#broadcast">Open broadcast settings →</Link>
          </p>
        </div>
      )}

      <div className="db-quick-actions">
        <Link href="/dashboard/upload" className="db-quick-action db-quick-action--primary">
          <SidebarNavIconSvg name="upload" />
          Upload a set
        </Link>
        <Link href="/dashboard#broadcast" className="db-quick-action">
          <SidebarNavIconSvg name="settings" />
          Broadcast settings
        </Link>
        <Link href={`/c/${channel.slug}`} className="db-quick-action">
          <IconView />
          View my channel
        </Link>
        <Link href="/dashboard/stats" className="db-quick-action">
          <IconChart />
          Full stats
        </Link>
      </div>

      <div className="db-recent-archive">
        <div className="db-recent-archive__header">
          <h2 className="db-recent-archive__heading">Recent archive</h2>
          {archiveItems.length > 0 ? (
            <Link href="/dashboard#archive" className="db-recent-archive__view-all">
              View all →
            </Link>
          ) : null}
        </div>
        {archiveItems.length === 0 ? (
          <div className="studio-empty-card studio-mb-0">
            <p className="studio-empty-card__text">No archive items yet</p>
            <p className="studio-empty-card__hint">
              Upload a set or import from SoundCloud — it appears here and on your channel once
              published.
            </p>
            <Link
              href="/dashboard/upload"
              className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm"
            >
              Upload or import →
            </Link>
          </div>
        ) : (
          <ul className="db-recent-archive__list">
            {archiveItems.slice(0, 4).map((item) => {
              const dur = typeof item.durationSec === 'number' ? item.durationSec : null
              const durationMin = dur ? `${Math.floor(dur / 60)}m` : null
              const ago = typeof item.createdAt === 'string' ? agoLabel(item.createdAt) : null
              return (
                <li key={item.id} className="db-recent-archive__item">
                  <div className="db-recent-archive__icon" aria-hidden>
                    ◉
                  </div>
                  <div className="db-recent-archive__body">
                    <div className="db-recent-archive__title">{item.title}</div>
                    <div className="db-recent-archive__meta">
                      {[durationMin, ago].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="db-recent-archive__actions">
                    <Link href="/dashboard#archive" className="db-recent-archive__link">
                      Edit
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {storageBar}

      {Boolean(downloadGateSummary || channelLiveStats || channelEgress) && (
        <StudioCollapse title="Analytics detail" hint="downloads, live time, egress">
          <DownloadGateSummaryPanel summary={downloadGateSummary} />
          <ChannelLiveStatsPanel stats={channelLiveStats} />
          <ChannelEgressPanel stats={channelEgress} />
        </StudioCollapse>
      )}

      {otherModeratedChannels.length > 0 && <ModerationAccess channels={otherModeratedChannels} />}
    </div>
  )
}

function ModerationAccess({ channels }: { channels: ModeratedChannel[] }) {
  return (
    <StudioCollapse
      title="Moderation access"
      hint={`${channels.length} channel${channels.length === 1 ? '' : 's'}`}
    >
      <ul className="studio-list studio-mt-sm">
        {channels.map((c) => (
          <li key={c.slug} className="studio-item-row--list">
            <span className="studio-flex-1">{c.displayName}</span>
            <Link
              href={`/dashboard/moderate/${c.slug}`}
              className="ui-btn ui-btn--sm ui-btn--ghost"
            >
              Moderate chat
            </Link>
          </li>
        ))}
      </ul>
    </StudioCollapse>
  )
}
