// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ComponentProps } from 'react'
import NextLink from 'next/link'
import { StatCard, StatCardGrid, StudioCollapse, SidebarNavIconSvg } from '@tahti/ui'
import BroadcastUsageBanner, { type BroadcastUsage } from './broadcast-usage'
import { ChannelHero } from './_channel-hero'
import { DownloadGateSummaryPanel } from './download-gate-summary'
import { ChannelLiveStatsPanel } from './channel-live-stats-panel'
import { ChannelEgressPanel } from './channel-egress-panel'

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
  channel: { slug: string; state: string; goneLiveAt: string | null } | null
  liveBroadcastTitle: string | null
  username: string
  isMember: boolean
  memberNumber: number | null
  broadcastUsage: BroadcastUsage | null
  weeklyListeners: number
  statDlCount: number
  revenueCents: number
  archiveItems: ArchiveItem[]
  downloadGateSummary: ComponentProps<typeof DownloadGateSummaryPanel>['summary']
  channelLiveStats: ComponentProps<typeof ChannelLiveStatsPanel>['stats']
  channelEgress: ComponentProps<typeof ChannelEgressPanel>['stats']
  otherModeratedChannels: ModeratedChannel[]
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
  liveBroadcastTitle,
  username,
  isMember,
  memberNumber,
  broadcastUsage,
  weeklyListeners,
  statDlCount,
  revenueCents,
  archiveItems,
  downloadGateSummary,
  channelLiveStats,
  channelEgress,
  otherModeratedChannels,
}: DashboardOverviewProps) {
  if (!channel) {
    const channelHost = `${username}.tahti.live`
    return (
      <div className="db-overview">
        <div className="db-no-channel-card">
          <div className="db-no-channel-card__icon" aria-hidden>
            <SidebarNavIconSvg name="channel" />
          </div>
          <h2 className="db-no-channel-card__title">Create your artist channel</h2>
          {isMember && memberNumber != null ? (
            <p className="db-no-channel-card__badge">Tahti member #{memberNumber}</p>
          ) : null}
          <p className="db-no-channel-card__hint">
            Your channel lives at <strong>{channelHost}</strong>. Broadcast live (1 hour per week
            included), upload sets to your archive, and connect with listeners — no extra steps
            required.
          </p>
          <div className="db-quick-actions db-quick-actions--centered db-no-channel-card__actions">
            <NextLink
              href="/dashboard/setup-channel"
              className="db-quick-action db-quick-action--primary"
            >
              <SidebarNavIconSvg name="channel" />
              Design your artist channel
            </NextLink>
            <NextLink href="/help/for-artists" className="db-quick-action">
              <IconGuide />
              Artist guide
            </NextLink>
          </div>
        </div>
        {otherModeratedChannels.length > 0 && (
          <ModerationAccess channels={otherModeratedChannels} />
        )}
      </div>
    )
  }

  const lastBroadcast =
    archiveItems[0] && typeof archiveItems[0].createdAt === 'string'
      ? { title: archiveItems[0].title, ago: agoLabel(archiveItems[0].createdAt) }
      : null

  return (
    <div className="db-overview">
      <ChannelHero
        slug={channel.slug}
        state={channel.state}
        goneLiveAt={channel.goneLiveAt}
        broadcastTitle={liveBroadcastTitle}
        lastBroadcast={channel.goneLiveAt ? null : lastBroadcast}
      />

      <BroadcastUsageBanner usage={broadcastUsage} />

      <StatCardGrid cols={3} aria-label="Channel summary">
        <StatCard
          variant="plays"
          value={weeklyListeners.toLocaleString()}
          label="Listeners this week"
        />
        <StatCard
          variant="downloads"
          value={statDlCount.toLocaleString()}
          label="Downloads this month"
        />
        <StatCard
          variant="revenue"
          value={`€${(revenueCents / 100).toFixed(0)}`}
          label="Fan-sub revenue"
        />
      </StatCardGrid>

      <div className="db-recent-archive">
        <div className="db-recent-archive__header">
          <h2 className="db-recent-archive__heading">Recent broadcasts</h2>
          {archiveItems.length > 0 ? (
            <NextLink href="/dashboard/archive" className="db-recent-archive__view-all">
              View all →
            </NextLink>
          ) : null}
        </div>
        {archiveItems.length === 0 ? (
          <div className="studio-empty-card studio-mb-0">
            <p className="studio-empty-card__text">No archive items yet</p>
            <p className="studio-empty-card__hint">
              Upload a set or import from SoundCloud — it appears here and on your channel once
              published.
            </p>
            <NextLink
              href="/dashboard/upload"
              className="ui-btn ui-btn--sm ui-btn--primary studio-mt-sm"
            >
              <SidebarNavIconSvg name="upload" />
              Upload or import →
            </NextLink>
          </div>
        ) : (
          <ul className="db-recent-archive__list">
            {archiveItems.slice(0, 2).map((item) => {
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
                    <NextLink href="/dashboard/archive" className="db-recent-archive__link">
                      Polish & publish →
                    </NextLink>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

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
            <NextLink
              href={`/dashboard/moderate/${c.slug}`}
              className="ui-btn ui-btn--sm ui-btn--ghost"
            >
              Moderate chat
            </NextLink>
          </li>
        ))}
      </ul>
    </StudioCollapse>
  )
}
