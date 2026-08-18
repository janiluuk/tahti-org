// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { TourStep } from './GuidedTour'

interface RouteEntry {
  test: (pathname: string) => boolean
  steps: TourStep[]
}

function bySteps(...groups: TourStep[][]): TourStep[] {
  return groups.flat()
}

/* ── Studio (artist / dashboard) chrome — present on every /dashboard page ── */

const STUDIO_TOP_BAR: TourStep[] = [
  {
    selector: '.studio-top-nav__logo',
    title: 'Home',
    body: 'The Tahti logo — click it anytime to jump back to your dashboard overview.',
  },
  {
    selector: '.studio-top-nav__golive-btn',
    title: 'Go live',
    body: "Red when you're offline — click to open the broadcast studio. Once you're live it turns into a shortcut to the stream manager, with status, listener count, and chat.",
  },
  {
    selector: '.studio-top-nav__icon-btn[aria-label="Upload"]',
    title: 'Quick upload',
    body: 'Upload a new track or release from anywhere in the studio without leaving the page you’re on.',
  },
  {
    selector: '.studio-top-nav__notif-btn[aria-label="Messages"]',
    title: 'Messages',
    body: 'Direct messages from fans and other artists.',
  },
  {
    selector: '.studio-top-nav__notif-btn[aria-label="Notifications"]',
    title: 'Notifications',
    body: 'New follows, comments, and activity on your channel.',
  },
  {
    selector: '.studio-top-nav__user',
    title: 'Account menu',
    body: 'Your public channel link, account settings, and log out.',
  },
]

const SIDEBAR: TourStep[] = [
  {
    selector: '.sidebar-nav',
    title: 'Studio navigation',
    body: 'Everything for running your channel lives here — stats, releases, broadcasting, audience tools, and settings, grouped by what they’re for.',
  },
]

const STUDIO_SHARED = bySteps(STUDIO_TOP_BAR, SIDEBAR)

const DASHBOARD_HOME: TourStep[] = [
  {
    selector: '[data-hero]',
    title: 'Channel status',
    body: 'Shows whether you’re live, previewing, or offline, plus a one-click way to start broadcasting.',
  },
  {
    selector: '[aria-label="Channel summary"]',
    title: 'Channel summary',
    body: 'This week’s listeners, downloads, and fan-subscription revenue at a glance.',
  },
  {
    selector: '.db-recent-archive__header',
    title: 'Recent broadcasts',
    body: 'Your latest archived sets and shows — open one to edit it, or view your full discography.',
  },
]

const BROADCAST_STEPS: TourStep[] = [
  {
    selector: '.broadcast-wizard',
    title: 'Setup steps',
    body: 'Broadcasting has three steps: connect your software, preview, then go live. Locked steps unlock once the one before it is done.',
  },
  {
    selector: '.broadcast-studio__toggles',
    title: 'Preflight checks',
    body: 'Toggle stream settings before you go live — these apply the moment your broadcast software connects.',
  },
  {
    selector: '.broadcast-studio__preview-actions',
    title: 'Preview',
    body: 'Listen to your own stream privately before it reaches your audience.',
  },
]

const UPLOAD_STEPS: TourStep[] = [
  {
    selector: '.upload-entry__tile--drop',
    title: 'Upload a track',
    body: 'Drop an audio file here or click to browse — FLAC, WAV, AIFF, MP3, M4A, or OGG, up to 4 GB.',
  },
]

const STATS_STEPS: TourStep[] = [
  {
    selector: '.stats-view-tabs',
    title: 'Stats sections',
    body: 'Switch between the overview and deeper breakdowns of your listener activity.',
  },
  {
    selector: '.stats-range-tabs',
    title: 'Time range',
    body: 'Change the period these numbers cover.',
  },
  {
    selector: '.stats-headline-metrics',
    title: 'Key metrics',
    body: 'Your headline numbers for the selected period.',
  },
  {
    selector: '.stats-panel',
    title: 'Engagement units',
    body: 'How your plays and downloads translate into the grant-funding pool this year.',
  },
]

const REVENUE_STEPS: TourStep[] = [
  {
    selector: '.revenue-grid',
    title: 'Payout history',
    body: 'Every payout you’ve received from fan subscriptions, and where the rest of each euro goes.',
  },
]

const ARCHIVE_STEPS: TourStep[] = [
  {
    selector: '.archive-list__toolbar',
    title: 'Filter and sort',
    body: 'Filter your discography by type or search, and switch between list views.',
  },
]

const PLAYLIST_STEPS: TourStep[] = [
  {
    selector: '.studio-channel-editor-page__header',
    title: '24/7 channel playlist',
    body: 'The tracks that play on your channel when you’re not live — reorder or swap them here.',
  },
]

const DESIGN_STEPS: TourStep[] = [
  {
    selector: '.studio-channel-editor__preview-col',
    title: 'Live preview',
    body: 'See how your channel page looks as you change it.',
  },
  {
    selector: '.studio-channel-editor__controls-col',
    title: 'Appearance controls',
    body: 'Cover art, theme colors, backdrop, and layout for your public channel page.',
  },
  {
    selector: '.studio-designer-presskit',
    title: 'Press kit',
    body: 'Promotional images press and venues can download directly.',
  },
]

const NEWSLETTER_STEPS: TourStep[] = [
  {
    selector: '.import-page__panel',
    title: 'Compose',
    body: 'Write an update for your subscribed fans — the panel on the right shows how it’ll land in their inbox.',
  },
  {
    selector: '.nl-compose-grid',
    title: 'Subject and body',
    body: 'Keep it short — fans see the subject line first.',
  },
]

const STUDIO_ROUTES: RouteEntry[] = [
  { test: (p) => p === '/dashboard', steps: bySteps(STUDIO_SHARED, DASHBOARD_HOME) },
  {
    test: (p) => p.startsWith('/dashboard/broadcast'),
    steps: bySteps(STUDIO_SHARED, BROADCAST_STEPS),
  },
  { test: (p) => p.startsWith('/dashboard/upload'), steps: bySteps(STUDIO_SHARED, UPLOAD_STEPS) },
  { test: (p) => p.startsWith('/dashboard/stats'), steps: bySteps(STUDIO_SHARED, STATS_STEPS) },
  { test: (p) => p.startsWith('/dashboard/revenue'), steps: bySteps(STUDIO_SHARED, REVENUE_STEPS) },
  { test: (p) => p.startsWith('/dashboard/archive'), steps: bySteps(STUDIO_SHARED, ARCHIVE_STEPS) },
  {
    test: (p) => p.startsWith('/dashboard/channel/playlist'),
    steps: bySteps(STUDIO_SHARED, PLAYLIST_STEPS),
  },
  {
    test: (p) => p.startsWith('/dashboard/channel/edit'),
    steps: bySteps(STUDIO_SHARED, DESIGN_STEPS),
  },
  {
    test: (p) => p.startsWith('/dashboard/newsletter'),
    steps: bySteps(STUDIO_SHARED, NEWSLETTER_STEPS),
  },
  { test: () => true, steps: STUDIO_SHARED },
]

/** Studio (artist/dashboard) tour steps for the given pathname. */
export function getStudioTourSteps(pathname: string): TourStep[] {
  return (STUDIO_ROUTES.find((r) => r.test(pathname)) ?? STUDIO_ROUTES[STUDIO_ROUTES.length - 1]!)
    .steps
}

/* ── Public (listener) chrome — ChannelHeader, used on profile/channel/
   subscribe/radio-show pages and every PublicBrandShell page ── */

const PUBLIC_TOP_BAR: TourStep[] = [
  {
    selector: '.ch-logo',
    title: 'Home',
    body: 'The Tahti logo — takes you back to the front page.',
  },
  {
    selector: '.ch-header__nav',
    title: 'Site navigation',
    body: 'Discover artists, tune in to Tahti Radio, or browse upcoming venues and events.',
  },
  {
    selector:
      '.studio-top-nav__notif-btn[aria-label="Messages"], .ch-header .studio-top-nav__notif-btn[aria-label="Messages"]',
    title: 'Messages',
    body: 'Direct messages between you and artists you follow.',
  },
  {
    selector: '.ch-header__user, .ch-header__artist-panel',
    title: 'Account',
    body: 'Your profile, artist panel (if you have a channel), and log out.',
  },
]

const PROFILE_STEPS: TourStep[] = [
  {
    selector: '.prof-cover',
    title: 'Cover and avatar',
    body: 'The artist’s chosen look for their page — photo or color theme.',
  },
  {
    selector: '.prof-cta-row',
    title: 'Follow and support',
    body: 'Follow for free updates, or support the artist directly with a paid subscription.',
  },
  {
    selector: '.prof-tabs__bar',
    title: 'Profile sections',
    body: 'Switch between the artist’s tracks, releases, pinned highlights, and more.',
  },
]

const CHANNEL_LIVE_STEPS: TourStep[] = [
  {
    selector: '.ch-artist-header',
    title: 'Artist info',
    body: 'Who you’re listening to — follow, support, or open their full profile from here.',
  },
]

const COLLECTION_STEPS: TourStep[] = [
  {
    selector: '.prof-collection-hero-row',
    title: 'Collection',
    body: 'A curated set of tracks the artist grouped together — a DJ set, playlist, or release series.',
  },
]

const RADIO_SHOW_STEPS: TourStep[] = [
  {
    selector: '.ch-artist-header',
    title: 'On Tahti Radio',
    body: 'This artist’s scheduled slot on the shared Tahti Radio channel.',
  },
]

const GOVERNANCE_STEPS: TourStep[] = [
  {
    selector: '.gov-topics-card',
    title: 'Topics',
    body: 'Post ideas for Tahti, discuss them, and vote on what other members have proposed.',
  },
  {
    selector: '[aria-label="Motion voting statistics"]',
    title: 'Statistics',
    body: 'How past motions were decided, board resolutions, and quarterly topic reports.',
  },
]

const TRANSPARENCY_STEPS: TourStep[] = [
  {
    selector: '.transparency-grid',
    title: 'Ledger',
    body: 'Every euro that moves through Tahti ry, and where membership fees and surplus go.',
  },
]

const PUBLIC_ROUTES: RouteEntry[] = [
  {
    test: (p) => /^\/u\/[^/]+\/subscribe/.test(p),
    steps: bySteps(PUBLIC_TOP_BAR, [
      {
        selector: '.prof-page-title',
        title: 'Support this artist',
        body: 'Choose a fan-subscription tier — recurring support goes directly to the artist.',
      },
    ]),
  },
  {
    test: (p) => /^\/u\/[^/]+\/c\/[^/]+/.test(p),
    steps: bySteps(PUBLIC_TOP_BAR, COLLECTION_STEPS),
  },
  { test: (p) => /^\/u\/[^/]+\/?$/.test(p), steps: bySteps(PUBLIC_TOP_BAR, PROFILE_STEPS) },
  { test: (p) => p.startsWith('/c/'), steps: bySteps(PUBLIC_TOP_BAR, CHANNEL_LIVE_STEPS) },
  { test: (p) => p.startsWith('/radio/show/'), steps: bySteps(PUBLIC_TOP_BAR, RADIO_SHOW_STEPS) },
  { test: (p) => p.startsWith('/governance'), steps: bySteps(PUBLIC_TOP_BAR, GOVERNANCE_STEPS) },
  {
    test: (p) => p.startsWith('/transparency'),
    steps: bySteps(PUBLIC_TOP_BAR, TRANSPARENCY_STEPS),
  },
  { test: () => true, steps: PUBLIC_TOP_BAR },
]

/** Public (listener-facing) tour steps for the given pathname. */
export function getPublicTourSteps(pathname: string): TourStep[] {
  return (PUBLIC_ROUTES.find((r) => r.test(pathname)) ?? PUBLIC_ROUTES[PUBLIC_ROUTES.length - 1]!)
    .steps
}
