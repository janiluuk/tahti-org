// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  AdminShell,
  BrandHeading,
  BrandSectionLabel,
  BrandText,
  BroadcastStatusBar,
  ChannelPageShell,
  DashboardShell,
  DspLinkButton,
  DspLinkButtonList,
  LiveChatPanel,
  PinnedAnnouncement,
  PublicShell,
  ReleaseSmartLink,
  SidebarNav,
  SidebarNavItem,
  StickyLiveBar,
  StatCard,
  StatCardGrid,
  TierCard,
  TierCardGrid,
} from '@tahti/ui'
import { PlaygroundWaveformDemo } from './playground-demos'

const DASHBOARD_NAV = [
  { href: '#channel', icon: 'channel' as const, label: 'Channel', active: true },
  { href: '#stats', icon: 'stats' as const, label: 'Stats' },
  { href: '#archive', icon: 'archive' as const, label: 'Archive' },
  { href: '#revenue', icon: 'revenue' as const, label: 'Revenue' },
  { href: '#settings', icon: 'settings' as const, label: 'Settings' },
]

const ADMIN_NAV = (
  <SidebarNav label="Admin">
    <SidebarNavItem href="#dashboard" icon="stats" active>
      Dashboard
    </SidebarNavItem>
    <SidebarNavItem href="#streams" icon="channel">
      Streams
    </SidebarNavItem>
    <SidebarNavItem href="#support" icon="newsletter">
      Support
    </SidebarNavItem>
    <SidebarNavItem href="#audit" icon="admin">
      Audit log
    </SidebarNavItem>
  </SidebarNav>
)

const DEMO_CHAT_MESSAGES = [
  { id: '1', handle: 'neon_ghost', text: 'this set is incredible' },
  {
    id: '2',
    handle: 'dj-moonrise',
    text: 'thanks — three new originals tonight',
    tone: 'artist' as const,
  },
]

export function PlaygroundComposites() {
  return (
    <>
      <PlaygroundSection title="DashboardShell" id="dashboard-shell">
        <DashboardShell displayName="dj-moonrise" isLive navItems={DASHBOARD_NAV}>
          <BroadcastStatusBar
            state="live"
            listeners={47}
            elapsed="24:37"
            showName="Moonrise Sessions — Live"
          />
          <StatCardGrid cols={4}>
            <StatCard variant="plays" value="1,247" label="Plays this month" />
            <StatCard variant="downloads" value="89" label="Downloads" />
            <StatCard variant="fans" value="23" label="Fan subscribers" />
            <StatCard variant="revenue" value="€115" label="Revenue / mo" />
          </StatCardGrid>
        </DashboardShell>
      </PlaygroundSection>

      <PlaygroundSection title="ChannelPageShell" id="channel-page-shell">
        <div className="playground-channel-shell">
          <ChannelPageShell
            isLive
            artistHandle="dj-moonrise"
            main={
              <div className="playground-channel-main">
                <BrandHeading level={2}>Moonrise Sessions — Live</BrandHeading>
                <BrandText tone="secondary">Ambient · originals · 24/7 archive rotation</BrandText>
                <PlaygroundWaveformDemo />
              </div>
            }
            sidebar={
              <LiveChatPanel
                surface="channel"
                listeners={47}
                pinned={<PinnedAnnouncement>Tonight 22:00 UTC — ambient set</PinnedAnnouncement>}
                messages={DEMO_CHAT_MESSAGES}
                readOnly
              />
            }
          />
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="PublicShell" id="public-shell">
        <div data-tahti-ui="brand" className="playground-public-shell">
          <PublicShell center>
            <BrandHeading level={2}>Public page shell</BrandHeading>
            <BrandText tone="secondary">
              Light centered layout for auth, verify, and marketing gateway routes. Import{' '}
              <code>brand-public.css</code> on the route.
            </BrandText>
          </PublicShell>
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="AdminShell" id="admin-shell">
        <AdminShell displayName="Board Member" sidebar={ADMIN_NAV}>
          <BrandSectionLabel>Platform overview</BrandSectionLabel>
          <BrandText tone="secondary">
            Admin composite — amber view strip, sidebar slot, main content area.
          </BrandText>
        </AdminShell>
      </PlaygroundSection>

      <PlaygroundSection title="ReleaseSmartLink" id="release-smart-link">
        <ReleaseSmartLink
          releaseId="demo-release-001"
          title="Neon Ghost"
          artistName="dj-moonrise"
          releaseType="EP"
          trackCount={4}
          year={2026}
          quote="Recorded live at the lab — four tracks of late-night ambient."
          footer={
            <BrandText tone="tertiary" size="xs">
              Powered by tahti.live · @dj-moonrise
            </BrandText>
          }
        >
          <DspLinkButtonList>
            <DspLinkButton
              href="https://open.spotify.com"
              platform="spotify"
              label="Spotify"
              verb="Stream"
              primary
            />
            <DspLinkButton
              href="https://bandcamp.com"
              platform="bandcamp"
              label="Bandcamp"
              verb="Buy / Free DL"
            />
            <DspLinkButton
              href="https://tidal.com"
              platform="tidal"
              label="Tidal"
              verb="FLAC · best quality"
            />
          </DspLinkButtonList>
        </ReleaseSmartLink>
      </PlaygroundSection>

      <PlaygroundSection title="TierCard" id="tier-card">
        <TierCardGrid>
          <TierCard
            name="Supporter"
            priceLabel="€3.00"
            perks={['Fan chat access', 'Early archive drops']}
          />
          <TierCard
            name="Backer"
            priceLabel="€5.00"
            featured
            perks={['Everything in Supporter', 'Monthly newsletter', 'Name in credits']}
          />
          <TierCard
            name="Patron"
            priceLabel="€10.00"
            perks={['Everything in Backer', 'Stash file sharing', 'Direct line to artist']}
          />
        </TierCardGrid>
      </PlaygroundSection>

      <PlaygroundSection title="StickyLiveBar" id="sticky-live-bar">
        <div data-tahti-ui="brand" className="playground-sticky-live-wrap">
          <StickyLiveBar
            artistName="dj-moonrise"
            channelHref="#live-player"
            listeners={47}
            isFlac
          />
        </div>
      </PlaygroundSection>
    </>
  )
}

function PlaygroundSection({
  title,
  id,
  children,
}: {
  title: string
  id: string
  children: React.ReactNode
}) {
  return (
    <section className="playground-section" id={id} data-component={id}>
      <BrandSectionLabel as="h2" className="playground-section-title">
        {title}
      </BrandSectionLabel>
      <div className="playground-section-body">{children}</div>
    </section>
  )
}
