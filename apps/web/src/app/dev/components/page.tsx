// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import {
  AvatarTile,
  BrandButton,
  BrandField,
  BrandHeading,
  BrandInput,
  BrandSectionLabel,
  BrandText,
  BroadcastStatusBar,
  BrowserFrame,
  CoverArt,
  Pill,
  PinnedAnnouncement,
  SidebarNav,
  SidebarNavItem,
  StatCard,
  StatCardGrid,
} from '@tahti/ui'
import {
  PlaygroundChatDemo,
  PlaygroundCoverUploadDemo,
  PlaygroundWaveformDemo,
} from './playground-demos'
import { PlaygroundComposites } from './playground-composites'

/** Dev-only component playground — compare each section to v8 mockups. */
export default function ComponentsPlaygroundPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <div className="playground-root">
      <header className="playground-header">
        <BrandHeading level={1}>Tahti component playground</BrandHeading>
        <BrandText tone="secondary">
          Build primitives here first. Compare side-by-side with v8 mockups before touching
          user-facing routes. See <code>docs/design/README.md</code>.
        </BrandText>
      </header>

      <PlaygroundSection title="Typography" id="typography">
        <div className="playground-stack">
          <BrandHeading level={1}>Display / H1</BrandHeading>
          <BrandHeading level={2}>Section heading H2</BrandHeading>
          <BrandHeading level={3}>Subsection H3</BrandHeading>
          <BrandText>Body text — primary tone for labels and copy.</BrandText>
          <BrandText tone="secondary">Secondary tone for supporting copy.</BrandText>
          <BrandText tone="tertiary">Tertiary tone for metadata.</BrandText>
          <BrandSectionLabel>Section label uppercase</BrandSectionLabel>
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="StatCard" id="stat-card">
        <StatCardGrid cols={4}>
          <StatCard variant="plays" value="1,247" label="Plays this month" />
          <StatCard variant="downloads" value="89" label="Downloads" />
          <StatCard variant="fans" value="23" label="Fan subscribers" />
          <StatCard variant="revenue" value="€115" label="Revenue / mo" />
        </StatCardGrid>
      </PlaygroundSection>

      <PlaygroundSection title="Button" id="button">
        <div className="playground-row">
          <BrandButton variant="primary">Primary (cyan)</BrandButton>
          <BrandButton variant="secondary">Secondary</BrandButton>
          <BrandButton variant="warn">Warn</BrandButton>
          <BrandButton variant="danger">Danger</BrandButton>
          <BrandButton variant="sm">Small</BrandButton>
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="Pill" id="pill">
        <div className="playground-row">
          <Pill variant="live" />
          <Pill variant="flac" />
          <Pill variant="archive" />
          <Pill variant="recommended" />
          <Pill variant="default">Draft</Pill>
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="Input" id="input">
        <BrandField label="Artist name" htmlFor="playground-artist">
          <BrandInput id="playground-artist" placeholder="DJ Moonrise" />
        </BrandField>
        <BrandField label="Stream key" htmlFor="playground-key">
          <BrandInput id="playground-key" mono placeholder="sk_live_…" />
        </BrandField>
      </PlaygroundSection>

      <PlaygroundSection title="CoverArt" id="cover-art">
        <div className="playground-row playground-row--align-end">
          <CoverArt size="xs" gradient="aurora" alt="24px placeholder" />
          <CoverArt size="sm" gradient="coral" alt="46px placeholder" />
          <CoverArt size="md" gradient="deep" alt="80px placeholder" />
          <CoverArt size="lg" gradient="violet" alt="140px placeholder" />
          <CoverArt size="full" gradient="aurora" alt="280px smart-link size" />
        </div>
        <BrandText tone="tertiary" size="xs">
          Sizes: xs 24 · sm 46 · md 80 · lg 140 · full 280. Gradients: aurora, coral, deep, amber,
          violet.
        </BrandText>
      </PlaygroundSection>

      <PlaygroundSection title="CoverImageUpload" id="cover-image-upload">
        <PlaygroundCoverUploadDemo />
        <BrandText tone="tertiary" size="xs">
          Drag/drop, click-to-browse, or the 🔗 URL toggle to fetch-and-rehost an external image.
          The same component now backs release artwork, archive banners, collection covers, and
          avatars.
        </BrandText>
      </PlaygroundSection>

      <PlaygroundSection title="AvatarTile" id="avatar-tile">
        <div className="playground-row playground-row--align-end">
          <AvatarTile size="xs" name="DJ Moonrise" gradient="aurora" />
          <AvatarTile size="sm" name="DJ Moonrise" gradient="aurora" />
          <AvatarTile size="md" name="DJ Moonrise" gradient="aurora" bordered />
          <AvatarTile size="lg" name="DJ Moonrise" gradient="coral" />
          <AvatarTile size="full" name="Neon Ghost" gradient="deep" />
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="PinnedAnnouncement" id="pinned-announcement">
        <PinnedAnnouncement>
          Tonight 22:00 UTC — ambient set, three new originals
        </PinnedAnnouncement>
      </PlaygroundSection>

      <PlaygroundSection title="WaveformPlayer" id="waveform-player">
        <PlaygroundWaveformDemo />
      </PlaygroundSection>

      <PlaygroundSection title="BroadcastStatusBar" id="broadcast-status-bar">
        <div className="playground-stack">
          <BroadcastStatusBar
            state="live"
            listeners={47}
            elapsed="24:37"
            showName="Moonrise Sessions — Live"
            action={<BrandButton variant="warn">End Broadcast</BrandButton>}
          />
          <BroadcastStatusBar
            state="offline"
            offlineMessage="Channel offline · last broadcast 2 days ago"
          />
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="LiveChatPanel" id="live-chat-panel">
        <div className="playground-chat-wrap">
          <PlaygroundChatDemo />
        </div>
      </PlaygroundSection>

      <PlaygroundSection title="SidebarNav" id="sidebar-nav">
        <SidebarNav>
          <SidebarNavItem href="#channel" icon="channel" active>
            Channel
          </SidebarNavItem>
          <SidebarNavItem href="#stats" icon="stats">
            Stats
          </SidebarNavItem>
          <SidebarNavItem href="#archive" icon="archive">
            Archive
          </SidebarNavItem>
          <SidebarNavItem href="#revenue" icon="revenue">
            Revenue
          </SidebarNavItem>
          <SidebarNavItem href="#newsletter" icon="newsletter">
            Newsletter
          </SidebarNavItem>
          <SidebarNavItem href="#links" icon="links">
            Smart Links
          </SidebarNavItem>
          <SidebarNavItem href="#distribution" icon="distribution">
            Distribution
          </SidebarNavItem>
          <SidebarNavItem href="#settings" icon="settings">
            Settings
          </SidebarNavItem>
          <SidebarNavItem href="#stash" icon="stash">
            Stash
          </SidebarNavItem>
        </SidebarNav>
      </PlaygroundSection>

      <PlaygroundSection title="BrowserFrame (mockup-only)" id="browser-frame">
        <BrowserFrame url="https://tahti.eu/u/dj-moonrise">
          <div className="playground-browser-demo">
            <AvatarTile size="md" name="DJ Moonrise" gradient="aurora" bordered />
            <BrandHeading level={3}>dj-moonrise</BrandHeading>
            <BrandText tone="secondary">Listener profile preview inside mockup chrome.</BrandText>
          </div>
        </BrowserFrame>
      </PlaygroundSection>

      <PlaygroundSection title="Phase C — primitives" id="phase-c-header">
        <BrandText tone="secondary">
          All 14 primitives from the v8 reference pack are listed above.
        </BrandText>
      </PlaygroundSection>

      <header className="playground-phase-header">
        <BrandHeading level={2}>Phase D — composites</BrandHeading>
        <BrandText tone="secondary">
          Layout shells and page building blocks composed from primitives. Compare to v8 mockups
          before migrating user-facing routes.
        </BrandText>
      </header>

      <PlaygroundComposites />
    </div>
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
