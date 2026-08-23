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
    body: "Red when you're offline, green while you're actually on air. Click it for a quick status check — how long you've been live, or a countdown if you've got a slot scheduled — plus a one-click way through to the stream manager.",
  },
  {
    selector: '.studio-top-nav__icon-btn[aria-label="Upload"]',
    title: 'Quick upload',
    body: 'Upload a new track or release from anywhere in the studio without leaving the page you’re on.',
  },
  {
    selector: '.studio-top-nav__notif-btn[aria-label="Messages"]',
    title: 'Messages',
    body: 'Direct messages from fans and other artists — click for a quick preview of your recent conversations, then open one to read the full thread and reply.',
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
    body: 'This week’s listeners, downloads, and fan-subscription revenue at a glance — the same numbers behind the fuller breakdown on the Stats page.',
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
    body: 'Listen to your own stream privately before it reaches your audience — a chance to catch a bad mix or a dead mic before anyone else does.',
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
    body: 'Switch between the overview and deeper breakdowns of your listener activity — where plays come from, and how they’re trending.',
  },
  {
    selector: '.stats-range-tabs',
    title: 'Time range',
    body: 'Switch between the last 7 days, the last 30 days, or your all-time totals — every chart and number below updates to match.',
  },
  {
    selector: '.stats-headline-metrics',
    title: 'Key metrics',
    body: 'Minutes listened, minutes streamed, downloads, and your current follower count for the selected period, at a glance before you dig into the breakdowns below.',
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
    body: 'A running preview of your public channel page — every change on the right updates here immediately, so you can see the real result before anyone else does.',
  },
  {
    selector: '.studio-channel-editor__controls-col',
    title: 'Appearance controls',
    body: 'Cover art, theme colors, backdrop, and layout for your public channel page.',
  },
  {
    selector: '.studio-designer-presskit',
    title: 'Press kit',
    body: 'Upload and arrange promoter-ready images here — once published, press and venues can browse and download them straight from your public profile.',
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
    body: 'Keep it short — fans see the subject line first, so lead with the reason they should open it. You can send to everyone subscribed, or narrow it to paying fan subscribers only.',
  },
]

const SMART_LINKS_STEPS: TourStep[] = [
  {
    selector: '.import-page__panel',
    title: 'Your releases',
    body: 'Every release gets its own smart link page — one URL that routes fans to Spotify, Apple Music, and wherever else you’re distributed.',
  },
  {
    selector: '.studio-release-card',
    title: 'Release card',
    body: 'Edit metadata, swap cover art, or copy the smart link straight from here.',
  },
]

const DISTRIBUTION_STEPS: TourStep[] = [
  {
    selector: '.studio-mixcloud-box, .import-connect',
    title: 'Spotify artist profile',
    body: 'Link your Spotify for Artists profile so streaming stats can show up alongside your Tahti stats.',
  },
  {
    selector: '.ui-panel.studio-mt-md',
    title: 'DSP delivery',
    body: 'Submit releases to streaming platforms and track UPC/ISRC/MusicBrainz identifiers for each one.',
  },
]

const STASH_STEPS: TourStep[] = [
  {
    selector: '.stash-upload-btn',
    title: 'Private stash',
    body: 'Upload work-in-progress files here — nothing in your stash is public until you move it to a release.',
  },
]

const RECORDINGS_STEPS: TourStep[] = [
  {
    selector: '.import-page__broadcast-list, .studio-empty-card',
    title: 'Recorded shows',
    body: 'Every past live broadcast is recorded automatically — publish one to your archive or download it here.',
  },
]

const SCHEDULE_STEPS: TourStep[] = [
  {
    selector: '.studio-show-series-grid',
    title: 'Show series',
    body: 'Set up a recurring show — fans see the next scheduled time on your channel page.',
  },
]

const VENUES_STEPS: TourStep[] = [
  {
    selector: '.venue-manager, .studio-empty-card',
    title: 'Your venues',
    body: 'Venues you’ve claimed or registered — board-verified venues can host your scheduled events.',
  },
]

const EVENTS_STEPS: TourStep[] = [
  {
    selector: '.studio-grid.studio-grid--2',
    title: 'Add an event',
    body: 'List an upcoming gig with a date, place, and ticket link — it shows on your profile as your next appearance.',
  },
]

const RADIO_SLOT_STEPS: TourStep[] = [
  {
    selector: '.studio-radio-calendar',
    title: 'Book a slot',
    body: 'Pick an open hour on the shared Tahti Radio schedule — click and drag to select, then choose live set or talk.',
  },
]

const EMBEDS_STEPS: TourStep[] = [
  {
    selector: '.studio-field',
    title: 'Add an embed',
    body: 'Pull in a SoundCloud, Mixcloud, or Hearthis track to show alongside your own uploads.',
  },
]

const POSTS_STEPS: TourStep[] = [
  {
    selector: '.studio-field',
    title: 'New post',
    body: 'Share a text update with photos to your followers — shows up in their feed and on your profile.',
  },
]

const SETTINGS_STEPS: TourStep[] = [
  {
    selector: '.settings-subnav',
    title: 'Settings sections',
    body: 'Account, artist info, connections, notifications, and everything else that configures your channel lives here.',
  },
]

const STUDIO_ROUTES: RouteEntry[] = [
  { test: (p) => p === '/dashboard', steps: bySteps(STUDIO_SHARED, DASHBOARD_HOME) },
  {
    test: (p) => p.startsWith('/dashboard/broadcast'),
    steps: bySteps(STUDIO_SHARED, BROADCAST_STEPS),
  },
  {
    // Exact match only — the drop tile UPLOAD_STEPS spotlights lives on this
    // page alone. Sub-routes (/upload/from-broadcast, /upload/[uploadId],
    // /upload/import/*) share the prefix but not the markup, and would
    // otherwise get a tour step with nothing to highlight.
    test: (p) => p === '/dashboard/upload' || p === '/dashboard/upload/',
    steps: bySteps(STUDIO_SHARED, UPLOAD_STEPS),
  },
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
  {
    test: (p) => p.startsWith('/dashboard/releases'),
    steps: bySteps(STUDIO_SHARED, SMART_LINKS_STEPS),
  },
  {
    test: (p) => p.startsWith('/dashboard/distribution'),
    steps: bySteps(STUDIO_SHARED, DISTRIBUTION_STEPS),
  },
  { test: (p) => p.startsWith('/dashboard/stash'), steps: bySteps(STUDIO_SHARED, STASH_STEPS) },
  {
    test: (p) => p.startsWith('/dashboard/recordings'),
    steps: bySteps(STUDIO_SHARED, RECORDINGS_STEPS),
  },
  {
    test: (p) => p.startsWith('/dashboard/schedule'),
    steps: bySteps(STUDIO_SHARED, SCHEDULE_STEPS),
  },
  { test: (p) => p.startsWith('/dashboard/venues'), steps: bySteps(STUDIO_SHARED, VENUES_STEPS) },
  { test: (p) => p.startsWith('/dashboard/events'), steps: bySteps(STUDIO_SHARED, EVENTS_STEPS) },
  {
    test: (p) => p.startsWith('/dashboard/tahti-radio-slots'),
    steps: bySteps(STUDIO_SHARED, RADIO_SLOT_STEPS),
  },
  { test: (p) => p.startsWith('/dashboard/embeds'), steps: bySteps(STUDIO_SHARED, EMBEDS_STEPS) },
  { test: (p) => p.startsWith('/dashboard/posts'), steps: bySteps(STUDIO_SHARED, POSTS_STEPS) },
  {
    test: (p) => p.startsWith('/dashboard/settings'),
    steps: bySteps(STUDIO_SHARED, SETTINGS_STEPS),
  },
  { test: () => true, steps: STUDIO_SHARED },
]

/** Studio (artist/dashboard) tour steps for the given pathname. */
export function getStudioTourSteps(pathname: string): TourStep[] {
  return (STUDIO_ROUTES.find((r) => r.test(pathname)) ?? STUDIO_ROUTES[STUDIO_ROUTES.length - 1]!)
    .steps
}

/* ── Admin chrome — AdminShellHeader, present on every /admin page ── */

const ADMIN_TOP_BAR: TourStep[] = [
  {
    selector: '.admin-top-logo',
    title: 'Admin home',
    body: 'Back to the ops dashboard from anywhere in the admin area.',
  },
  {
    selector: '.studio-top-nav__link[href="/dashboard"]',
    title: 'Switch to artist',
    body: 'Jump back to your own artist studio without logging out of admin.',
  },
  {
    selector: '.studio-top-nav__link[href="/governance"]',
    title: 'Governance',
    body: 'Board motions, votes, and the member governance process — the same page members see, from the admin side.',
  },
]

const ADMIN_SIDEBAR: TourStep[] = [
  {
    selector: 'nav[aria-label="Admin sections"]',
    title: 'Admin sections',
    body: 'Every moderation, financial, and platform-ops tool lives here, grouped by what it manages — users, money, content, and governance.',
  },
]

const ADMIN_SHARED = bySteps(ADMIN_TOP_BAR, ADMIN_SIDEBAR)

const ADMIN_DASHBOARD_STEPS: TourStep[] = [
  {
    selector: '.admin-dashboard-grid',
    title: 'Operations overview',
    body: 'Platform health at a glance — the numbers and alerts that tell you if anything needs attention today.',
  },
  {
    selector: '.admin-dashboard-actions',
    title: 'Quick actions',
    body: 'Shortcuts to the tools you reach for most, so routine admin work doesn’t need a trip through the sidebar.',
  },
]

const ADMIN_BETA_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Filter invites',
    body: 'Narrow the list by invite status while you work through the beta waitlist.',
  },
]

const ADMIN_USERS_STEPS: TourStep[] = [
  {
    selector: '.admin-search-input',
    title: 'Find a user',
    body: 'Search by name, username, or email to jump straight to one account.',
  },
  {
    selector: '.admin-table-wrap',
    title: 'User list',
    body: 'Every registered account — open one to see its channel, membership, and moderation history.',
  },
]

const ADMIN_RADIO_STEPS: TourStep[] = [
  {
    selector: '.admin-radio-count',
    title: 'Tahti Radio',
    body: 'The 24/7 shared channel’s current state — who’s booked, who’s on air, and the rotation feeding the gaps.',
  },
]

const ADMIN_RADIO_SUBMISSIONS_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Slot bookings',
    body: 'Review and approve artist requests to book a Tahti Radio slot.',
  },
]

const ADMIN_NEWS_STEPS: TourStep[] = [
  {
    selector: '.admin-section-title',
    title: 'News posts',
    body: 'Publish and edit the announcements that show up on the platform’s news feed.',
  },
]

const ADMIN_SELECTS_STEPS: TourStep[] = [
  {
    selector: '.admin-btn',
    title: 'Tahti Selects',
    body: 'Curate the featured rotation that highlights artist tracks across the platform.',
  },
]

const ADMIN_STREAMS_STEPS: TourStep[] = [
  {
    selector: '.admin-table-wrap',
    title: 'Live streams',
    body: 'Every channel currently broadcasting — check bitrate, listeners, and connection health in real time.',
  },
]

const ADMIN_SUPPORT_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Support queue',
    body: 'Open tickets from artists and listeners, filterable by status so nothing sits unanswered.',
  },
]

const ADMIN_TOP_LISTS_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Charts and leaderboards',
    body: 'Configure which top-lists appear publicly and how they’re calculated.',
  },
]

const ADMIN_ANNOUNCEMENTS_STEPS: TourStep[] = [
  {
    selector: '.admin-section-title',
    title: 'Site announcements',
    body: 'Banners shown platform-wide — schedule one, or edit what’s currently live.',
  },
]

const ADMIN_STORAGE_STEPS: TourStep[] = [
  {
    selector: '.admin-stat-sub',
    title: 'Storage usage',
    body: 'Total and per-user storage consumption, so you can see who’s approaching their limit before it becomes a problem.',
  },
]

const ADMIN_FILES_STEPS: TourStep[] = [
  {
    selector: '.admin-help',
    title: 'File and media admin',
    body: 'Look up and manage individual uploaded files directly, outside the normal artist upload flow.',
  },
]

const ADMIN_CONTENT_REPORTS_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Moderation reports',
    body: 'Content flagged by users, queued for review — resolve or dismiss each one with a reason.',
  },
]

const ADMIN_FINANCIAL_HUB_STEPS: TourStep[] = [
  {
    selector: '.admin-panel-grid',
    title: 'Financial tools',
    body: 'The ledger, fan-subscription revenue, and legacy membership records all branch off from here.',
  },
]

const ADMIN_LEDGER_STEPS: TourStep[] = [
  {
    selector: '.admin-table-wrap',
    title: 'Transaction ledger',
    body: 'Every euro moving through Tahti ry — the same append-only record members see on the public transparency page.',
  },
]

const ADMIN_FANSUBS_STEPS: TourStep[] = [
  {
    selector: '.admin-panel-grid',
    title: 'Fan-subscription revenue',
    body: 'What artists are earning from direct fan support, and the 2% Tahti keeps to cover processing.',
  },
]

const ADMIN_LEGACY_MEMBERS_STEPS: TourStep[] = [
  {
    selector: '.admin-table',
    title: 'Legacy memberships',
    body: 'Membership records carried over from before the current billing system — reference only.',
  },
]

const ADMIN_GOVERNANCE_HUB_STEPS: TourStep[] = [
  {
    selector: '.admin-panel-grid',
    title: 'Governance tools',
    body: 'The audit log, governance report, and board resolutions all branch off from here.',
  },
]

const ADMIN_GOVERNANCE_AUDIT_STEPS: TourStep[] = [
  {
    selector: '.admin-search-input',
    title: 'Audit log',
    body: 'Every admin action taken on this account or others, searchable — the record that backs the "all actions audit-logged" banner above.',
  },
]

const ADMIN_GOVERNANCE_REPORT_STEPS: TourStep[] = [
  {
    selector: '.admin-card',
    title: 'Governance report',
    body: 'A rollup of member proposals, votes, and outcomes for the current period.',
  },
]

const ADMIN_GOVERNANCE_RESOLUTIONS_STEPS: TourStep[] = [
  {
    selector: '.admin-card',
    title: 'Board resolutions',
    body: 'Formal decisions the board has made, kept here as the public record.',
  },
]

const ADMIN_FEATURE_REQUESTS_STEPS: TourStep[] = [
  {
    selector: '.admin-filter-pills',
    title: 'Feature requests',
    body: 'Ideas submitted by members — triage, comment, and mark status as they move through review.',
  },
]

const ADMIN_GRANTS_STEPS: TourStep[] = [
  {
    selector: '.admin-card',
    title: 'Grant program',
    body: 'The yearly grant pool artists share in — set the pot, review applications, and record awards per cycle.',
  },
]

const ADMIN_AGM_STEPS: TourStep[] = [
  {
    selector: '.admin-card',
    title: 'AGM management',
    body: 'Set up the annual general meeting — agenda, motions, and the voting window members will see.',
  },
]

const ADMIN_VENDORS_STEPS: TourStep[] = [
  {
    selector: '.admin-card',
    title: 'Vendors and contracts',
    body: 'Outside services and suppliers Tahti ry pays — hosting, legal, and the rest of the paper trail behind the published expenses.',
  },
]

const ADMIN_STATUS_STEPS: TourStep[] = [
  {
    selector: '.admin-table-wrap',
    title: 'System status',
    body: 'Live health for every service in the stack — the same signal the public status page is built from.',
  },
]

const ADMIN_ROUTES: RouteEntry[] = [
  {
    test: (p) => p === '/admin' || p === '/admin/dashboard',
    steps: bySteps(ADMIN_SHARED, ADMIN_DASHBOARD_STEPS),
  },
  { test: (p) => p.startsWith('/admin/beta'), steps: bySteps(ADMIN_SHARED, ADMIN_BETA_STEPS) },
  { test: (p) => p.startsWith('/admin/users'), steps: bySteps(ADMIN_SHARED, ADMIN_USERS_STEPS) },
  {
    test: (p) => p.startsWith('/admin/radio-submissions'),
    steps: bySteps(ADMIN_SHARED, ADMIN_RADIO_SUBMISSIONS_STEPS),
  },
  { test: (p) => p.startsWith('/admin/radio'), steps: bySteps(ADMIN_SHARED, ADMIN_RADIO_STEPS) },
  { test: (p) => p.startsWith('/admin/news'), steps: bySteps(ADMIN_SHARED, ADMIN_NEWS_STEPS) },
  {
    test: (p) => p.startsWith('/admin/tahti-selects'),
    steps: bySteps(ADMIN_SHARED, ADMIN_SELECTS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/streams'),
    steps: bySteps(ADMIN_SHARED, ADMIN_STREAMS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/support'),
    steps: bySteps(ADMIN_SHARED, ADMIN_SUPPORT_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/top-lists'),
    steps: bySteps(ADMIN_SHARED, ADMIN_TOP_LISTS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/announcements'),
    steps: bySteps(ADMIN_SHARED, ADMIN_ANNOUNCEMENTS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/storage'),
    steps: bySteps(ADMIN_SHARED, ADMIN_STORAGE_STEPS),
  },
  { test: (p) => p.startsWith('/admin/files'), steps: bySteps(ADMIN_SHARED, ADMIN_FILES_STEPS) },
  {
    test: (p) => p.startsWith('/admin/content-reports'),
    steps: bySteps(ADMIN_SHARED, ADMIN_CONTENT_REPORTS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/financial/ledger'),
    steps: bySteps(ADMIN_SHARED, ADMIN_LEDGER_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/financial/fansubs'),
    steps: bySteps(ADMIN_SHARED, ADMIN_FANSUBS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/financial/legacy-members'),
    steps: bySteps(ADMIN_SHARED, ADMIN_LEGACY_MEMBERS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/financial'),
    steps: bySteps(ADMIN_SHARED, ADMIN_FINANCIAL_HUB_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/governance/audit'),
    steps: bySteps(ADMIN_SHARED, ADMIN_GOVERNANCE_AUDIT_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/governance/report'),
    steps: bySteps(ADMIN_SHARED, ADMIN_GOVERNANCE_REPORT_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/governance/resolutions'),
    steps: bySteps(ADMIN_SHARED, ADMIN_GOVERNANCE_RESOLUTIONS_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/governance'),
    steps: bySteps(ADMIN_SHARED, ADMIN_GOVERNANCE_HUB_STEPS),
  },
  {
    test: (p) => p.startsWith('/admin/feature-requests'),
    steps: bySteps(ADMIN_SHARED, ADMIN_FEATURE_REQUESTS_STEPS),
  },
  { test: (p) => p.startsWith('/admin/grants'), steps: bySteps(ADMIN_SHARED, ADMIN_GRANTS_STEPS) },
  { test: (p) => p.startsWith('/admin/agm'), steps: bySteps(ADMIN_SHARED, ADMIN_AGM_STEPS) },
  {
    test: (p) => p.startsWith('/admin/settings/vendors'),
    steps: bySteps(ADMIN_SHARED, ADMIN_VENDORS_STEPS),
  },
  { test: (p) => p.startsWith('/admin/status'), steps: bySteps(ADMIN_SHARED, ADMIN_STATUS_STEPS) },
  { test: () => true, steps: ADMIN_SHARED },
]

/** Admin tour steps for the given pathname. */
export function getAdminTourSteps(pathname: string): TourStep[] {
  return (ADMIN_ROUTES.find((r) => r.test(pathname)) ?? ADMIN_ROUTES[ADMIN_ROUTES.length - 1]!)
    .steps
}

/* ── Public (listener) chrome — ChannelHeader, used on profile/channel/
   subscribe/radio-show pages and every PublicBrandShell page ── */

const PUBLIC_TOP_BAR: TourStep[] = [
  {
    selector: '.ch-logo',
    title: 'Home',
    body: 'The Tahti logo — takes you back to the front page from anywhere on the site.',
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
    body: 'Direct messages between you and artists you follow — the same inbox as the studio’s, just reachable from the public side of the site.',
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
    body: 'Switch between the artist’s tracks, releases, pinned highlights, and more — everything they’ve chosen to put on their page.',
  },
]

const CHANNEL_LIVE_STEPS: TourStep[] = [
  {
    selector: '.ch-artist-header',
    title: 'Artist info',
    body: 'Who you’re listening to — follow, support, or open their full profile from here.',
  },
  {
    selector: '[aria-label^="View photos"]',
    title: 'Photos',
    body: 'Browse this artist’s gallery images full-size — zoom in and step through them like a slideshow.',
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
    body: 'This artist’s scheduled slot on the shared Tahti Radio channel — when their set starts, and how to catch it live.',
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
    body: 'How past motions were decided, board resolutions, and quarterly topic reports — the record of what the board and members have actually done.',
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
