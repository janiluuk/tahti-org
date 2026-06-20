# Tahti — agent brief: design consistency + user journey completion

You are working inside the `janiluuk/tahti-org` repository. There is an open PR (#120) with partial implementation. The product is largely scaffolded but inconsistent in design and incomplete in user journeys — many pages are empty or stubs. Your job is to bring the application to a coherent, shippable state where:

1. Every page matches the **v8 mockups** (9 reference screenshots provided as `screenshot.zip`, see *Reference materials* below).
2. Every user journey for every persona (listener, artist, admin) has a real, working page — no empty stubs.
3. The design system is single-source-of-truth — every color, spacing value, and component pattern comes from tokens, not from one-off CSS.

This document is the single source of truth. Read it fully before writing any code.

---

## Critical context: prior design docs are wrong targets

There are at least two prior design documents in or around this project:

1. `docs/design-system.md` — describes a "Nordic minimalist" aesthetic with light fills, 0.5px borders, weight-500-max. **This was written by a different Claude that never saw the real product.** Discard it. Do not reconcile with it.
2. `agent-design-system-brief.md` — earlier brief based on the saturated-dashboard nocturne.fm screenshot. Partially relevant but superseded.

**The single canonical visual reference is `screenshot.zip` containing the 9 v8 mockups.** Everything else defers to those. If anything in this brief contradicts the screenshots, the screenshots win.

The constitutional rules in `docs/CONSTITUTION.md` still hold — they govern *what* gets built, not *how* it looks. Re-read them before starting; the design must serve the rules.

---

## Reference materials

### v8 mockups (the design target)

`screenshot.zip` contains 9 PNG files. The user will provide this — ask if it's not already in your working directory. Each shows a canonical view in the v8 design:

| File | View | URL pattern | Persona |
|---|---|---|---|
| 05-25-05 | Stats dashboard | `/dashboard/stats` | Artist |
| 05-25-25 | Release smart link page (published + pre-release variants) | `/r/<release-slug>` | Listener |
| 05-25-46 | Public artist profile | `/u/<handle>` | Listener |
| 05-25-55 | Live channel page (with chat) | `<handle>.tahti.eu` or `/<handle>` | Listener |
| 05-26-18 | Artist dashboard (channel overview) | `/dashboard` | Artist |
| 05-26-27 | Mobile mockups (listener view + profile) | mobile-responsive of above | Listener |
| 05-26-40 | Live + Chat detailed view | `/<handle>` (live state) | Listener |
| 05-26-50 | 24/7 Channel view (always-on, archive plays when not live) | `/<handle>` (offline state) | Listener |
| 05-26-55 | Private Stash (WIP storage with sharing) | `/app/stash` | Artist (paid) |

If you cannot see the screenshots, **stop and ask the user to provide them**. Do not proceed with implementation by guessing.

### PR #120

Read it before doing anything else:

```bash
gh pr view 120
gh pr diff 120 --color=never | less
gh pr checks 120
git checkout $(gh pr view 120 --json headRefName -q '.headRefName')
```

Document in your working notes: what does the PR claim to deliver? What's actually implemented vs stubbed? Which pages render at all vs which 404 or show "Coming soon"? This is your starting inventory.

### The constitution

`docs/CONSTITUTION.md` — three rules. Most importantly for design decisions:

- Rule 3 ("the artist shines brightest, no rip-offs") means: **no algorithmic feeds, no listener-count gamification, no upsell during listening**. The "Recommended for you" rail and the "Most played this week" leaderboard are forbidden, no matter how design-tempting.
- Rule 2 ("highest quality") means: **lossless FLAC streams for members are real and visible** — the LOSSLESS / FLAC badges in the mockups are functional, not decorative. The audio backend must actually deliver these bitrates.
- Rule 1 ("for artists, not corporate") means: **no Tahti-branded interruption** between the artist and the listener. The Tahti wordmark is small. The artist's brand is large.

---

## Phase 0: Discovery (mandatory before Phase 1)

Run these commands. Write findings to `/tmp/discovery.md`.

### 0.1 Repo orientation

```bash
# What's the stack?
cat package.json | jq '.dependencies, .devDependencies'

# Where do pages live?
find . -path ./node_modules -prune -o \( -name "page.tsx" -o -name "page.jsx" -o -name "page.ts" \) -print
find pages -type f 2>/dev/null

# Where's the design layer?
find . -maxdepth 4 \( -name "tailwind.config.*" -o -name "globals.css" -o -name "theme.*" -o -name "tokens.*" \) -not -path "*/node_modules/*"

# Component library?
ls components/ui 2>/dev/null && echo "shadcn-style" || echo "check components/"
grep -l "shadcn" package.json && echo "shadcn present"
grep -l "@radix-ui" package.json && echo "Radix primitives present"

# Authentication?
grep -rl "next-auth\|@clerk\|@supabase/auth\|lucia" --include=package.json --include=*.ts --include=*.tsx . 2>/dev/null | head -5
```

### 0.2 Page inventory

Build a complete list of every route in the application. For each route, determine:

- **Status**: rendered (returns full page) / stub (returns a heading + nothing) / 404 / not implemented at all
- **Persona**: listener (no auth needed) / artist (auth required) / admin (special role)
- **Matches mockup**: yes / partial / no / no-mockup-exists

Output format in `/tmp/discovery.md`:

```markdown
| Route | Persona | Status | Mockup match | File |
|---|---|---|---|---|
| `/` | public | rendered | partial | app/page.tsx |
| `/u/[handle]` | listener | stub | no | app/u/[handle]/page.tsx |
| `/dashboard` | artist | rendered | partial | app/dashboard/page.tsx |
| `/dashboard/stats` | artist | not implemented | n/a | — |
| `/app/stash` | artist (paid) | not implemented | n/a | — |
| ...
```

This table is your work list. Every "stub", "not implemented", or "partial" is a gap to close.

### 0.3 Token audit

```bash
# Tailwind theme
cat tailwind.config.* 2>/dev/null | head -100

# CSS variables in globals
grep -h "^[[:space:]]*--" app/globals.css src/globals.css styles/globals.css 2>/dev/null | sort -u

# Hardcoded colors that should be tokens
grep -rn '#[0-9a-fA-F]\{6\}' --include="*.tsx" --include="*.ts" --include="*.css" \
  app/ components/ lib/ 2>/dev/null | grep -v node_modules | head -50
```

If you find hardcoded hex values scattered through component files: that's the inconsistency the user is complaining about. Fix as you go.

### 0.4 Component inventory

What reusable components exist? Are they being used everywhere they should be, or are there duplicates?

```bash
ls components/ -la
ls components/ui/ -la 2>/dev/null

# Find duplicate-pattern code: e.g. multiple files implementing "stat card"
grep -rl "Plays this month\|Listeners now\|Engagement units" --include="*.tsx" components/ app/ | head
```

If there are three different "stat card" implementations, consolidate to one before touching any pages.

---

## Phase 1: Design system from the screenshots

### 1.1 Color tokens

Extract from the 9 screenshots. These are the canonical values. Add to `tailwind.config.ts` (or `app/globals.css` for CSS variables, depending on which v4 / v3 you're on):

**Background and surfaces:**

| Token | Hex | Use |
|---|---|---|
| `bg-page` | `#0A0E1C` | Outermost page background (very dark navy, almost black) |
| `bg-card` | `#11172A` | Card surface, sidebar background |
| `bg-card-elevated` | `#162038` | Elevated card (the inner card on a card) |
| `bg-card-hover` | `#1B2540` | Hover state on cards / list items |
| `border-subtle` | `#1F2940` | Card borders, 1px solid (not 0.5px — that's the old aesthetic) |
| `border-strong` | `#2A3550` | Section dividers, input borders |

**Brand accent (the cyan/teal that anchors the product):**

| Token | Hex | Use |
|---|---|---|
| `brand-50` | `#E6FBFC` | Lightest tint, rare |
| `brand-200` | `#7EE7EE` | Soft variant |
| `brand-400` | `#22D3EE` | **Primary brand — buttons, primary links, FLAC badge, active sidebar items** |
| `brand-600` | `#0891B2` | Hover/pressed state |
| `brand-800` | `#0E5C70` | Dark fill behind brand text |

**Stat card colors (these encode meaning — do not reassign):**

| Token | Hex | Use |
|---|---|---|
| `stat-plays` | `#FFB840` | Amber — plays / activity / "live now" countdown numbers |
| `stat-downloads` | `#3FE07A` | Green — downloads / engagement / "BROADCASTING NOW" status |
| `stat-fans` | `#A78BFA` | Purple — fan subscribers / support actions |
| `stat-revenue` | `#22D3EE` | Cyan (same as brand-400) — money in / revenue |

These four colors are **functional, not decorative**. Use them consistently across the product:
- Anywhere we count plays, use amber.
- Anywhere we count downloads, use green.
- Anywhere we count fan-subs, use purple.
- Anywhere we display euros/revenue, use cyan.

This is what makes the dashboard scannable at a glance. Do not use these colors as generic accents elsewhere — they have meaning.

**Semantic colors:**

| Token | Hex | Use |
|---|---|---|
| `live-green` | `#3FE07A` | LIVE indicator dot, "BROADCASTING NOW" |
| `live-bg` | `rgba(63,224,122,0.1)` | Live status pill background |
| `warn-amber` | `#FFB840` | Pinned announcements, "End Broadcast", countdown numbers |
| `warn-bg` | `rgba(255,184,64,0.08)` | Pinned announcement background fill |
| `warn-border` | `#FFB840` | Left border of pinned cards |
| `danger-coral` | `#F87171` | "Revoke", destructive actions |

**Text:**

| Token | Hex | Use |
|---|---|---|
| `text-primary` | `#E6E9F0` | Headings, body emphasis (off-white, not pure white) |
| `text-secondary` | `#A1A8BD` | Body copy, secondary labels |
| `text-tertiary` | `#5E6680` | Captions, metadata, uppercase section labels |
| `text-on-brand` | `#062028` | Text on cyan brand fills (dark, for contrast) |

**Cover-art / content accent palette** (for release artwork placeholders, channel avatars):

These are gradients, not flat fills. Use as `linear-gradient(135deg, A, B)`:

| Token | A → B | Use |
|---|---|---|
| `cover-aurora` | `#A78BFA → #22D3EE → #3FE07A` | Default/multi-color, the dj-moonrise avatar |
| `cover-coral` | `#F87171 → #FFB840` | Warm releases |
| `cover-deep` | `#5B6BC4 → #22D3EE` | Cool/ambient releases |
| `cover-amber` | `#FFB840 → #F59E0B` | Solid amber |
| `cover-violet` | `#8B5CF6 → #6366F1` | Solid cool |

Do not generate cover-art colors per-release randomly. Hash the release ID to one of 8-12 canonical gradients so the same release always shows the same color.

### 1.2 Typography

The screenshots show two fonts working in concert:

- **Display / wordmark**: A condensed-ish sans (looks like Inter, Geist, or possibly Söhne) used for "TAHTI" and section labels — letter-spaced when uppercase.
- **Body**: Same family, or a sister sans (Inter Regular). Used for everything else.
- **Mono**: For stream keys, file paths, URLs in browser-frame mockups, durations like `24:37 / LIVE`.

If the project already uses Inter or Geist, keep it. If it doesn't have a defined sans font, add Inter via `next/font/google`.

**Type scale (read off the screenshots):**

| Class | Size | Weight | Use |
|---|---|---|---|
| `text-stat-big` | 48px | 500 | Stat-card numbers (1,247 / 89 / €15) |
| `text-display` | 32px | 500 | "NEON GHOST" channel name, page H1 |
| `text-h2` | 22px | 500 | Section headers |
| `text-h3` | 18px | 500 | Card titles ("dj-moonrise", "Moonrise Sessions — Live") |
| `text-body` | 14px | 400 | Body copy, descriptions |
| `text-sm` | 13px | 400 | Secondary copy, list items |
| `text-xs` | 12px | 400 | Captions, metadata |
| `text-label` | 11px | 500 | Uppercase section labels (`ENGAGEMENT UNITS`, `TOP TRACKS`) — letter-spacing 0.08em |

**Weight rule**: only 400 and 500. Never 600+. If a heavier weight feels needed, the size is wrong.

**Letter-spacing rule**: uppercase labels and the brand wordmark get `tracking-[0.08em]` to `tracking-[0.12em]`. Everything else is default.

**Numeric rule**: enable tabular numerals on stat displays so digits align in monospace columns:

```css
.stat-number {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}
```

### 1.3 Spacing and radius

The screenshots show consistent generous spacing:

- Page padding: `24px` desktop, `16px` mobile
- Card padding: `20px` (small cards), `24px` (large cards)
- Gap between cards in a row/grid: `16px`
- Gap between sections: `32px`

Border radius:
- Small (buttons, badges, inputs): `8px` (`rounded-lg`)
- Cards: `12px` (`rounded-xl`)
- Browser-frame chrome (mockup demos only, not live app): `12px` outer, `8px` inner
- Pills (LIVE, ON AIR, LOSSLESS): `9999px` (`rounded-full`)

### 1.4 Component patterns

#### Browser-frame chrome (mockup-only)

Important clarification: **the mac-style browser frame visible in the screenshots is a presentation device for the design carousel, not the live app shell**. The live application does not render dots + URL bar around itself; the user's real browser provides that.

You will likely build a `<BrowserFrame>` component anyway, because:
1. The marketing site (`/about`, `/for-artists`) uses this device to show screenshots.
2. The design carousel at `/` (or wherever the mockups are shown to potential artists) needs it.
3. Documentation pages use it.

Spec:
```tsx
<BrowserFrame url="https://tahti.eu/u/dj-moonrise">
  <ChildContent />
</BrowserFrame>
```

Renders: rounded outer container with `bg-card-elevated`, header strip with three colored dots (red `#FF5F57`, yellow `#FEBC2E`, green `#28C840`) and a centered URL pill in `bg-card` with mono font.

#### Stat card

The four stat-card colors mean what they mean. Component API:

```tsx
<StatCard
  variant="plays" | "downloads" | "fans" | "revenue"
  value="1,247"
  label="Plays this month"
  delta={{ direction: 'up', text: '12% vs last' }}  // optional
/>
```

Visual: card with `bg-card-elevated`, rounded-xl, 24px padding, big number in the variant's color, label below in `text-secondary`. Optional delta below label in `live-green` (up) or `danger-coral` (down).

#### Sidebar nav

Eight items, from screenshot 5:
1. ▶ Channel (icon: broadcast / radio)
2. 📈 Stats (icon: chart)
3. 📁 Archive (icon: folder)
4. 💰 Revenue (icon: dollar / euro)
5. 📧 Newsletter (icon: mail)
6. 🔗 Smart Links (icon: link)
7. 🚀 Distribution (icon: rocket)
8. ⚙ Settings (icon: gear)

Plus, for member artists only:
9. 🔒 Stash (icon: lock) — links to `/app/stash`

Plus, role-conditional:
10. 🛡 Admin (icon: shield) — visible only to users with admin role

Active item gets `text-brand-400` + 2px left border in `brand-400` + slight background tint `bg-card-elevated`.

Use Lucide icons (it's likely already in the project). The icon labels in mockups (`▶ Channel`, `📈 Stats`) suggest a single character — replace with proper Lucide icons (`<Radio />`, `<BarChart3 />`, etc.).

#### Live broadcast status bar

The bright green strip that says "LIVE NOW · 47 listeners · 24:37 elapsed" with "End Broadcast" button on the right.

```tsx
<BroadcastStatusBar
  state="live" | "starting" | "ending" | "offline"
  listeners={47}
  elapsed="24:37"
  showName="Moonrise Sessions — Live"
  onEnd={() => ...}
/>
```

When `state="live"`: pulsing green dot + `live-green` text "LIVE NOW", `warn-amber` "End Broadcast" button.
When `state="offline"`: `bg-card-elevated` with "Channel offline · last broadcast 2 days ago".

#### Pinned announcement card

The amber-bordered card with pin emoji.

```tsx
<PinnedAnnouncement>
  Tonight 22:00 UTC — ambient set, three new originals
</PinnedAnnouncement>
```

`bg-warn-bg` fill, 3px `warn-border` left border, `rounded-r-xl rounded-l-none` (no left radius because of the border), `warn-amber` text for the 📌 PINNED label.

#### Live chat panel

Right-rail component. Channel header with listener count + LIVE dot, then ephemeral chat messages, then input.

Username colors are **per-handle deterministic** — hash the handle to one of 6-8 vibrant colors. Same user always shows in the same color across sessions.

Color set for usernames:
```
#22D3EE (cyan)   #FFB840 (amber)   #A78BFA (purple)
#3FE07A (green)  #F472B6 (pink)    #FB923C (coral)
#60A5FA (blue)   #C084FC (light purple)
```

Artist's own messages get `text-brand-400` with `(you)` or `(artist)` suffix.

Pinned messages by the artist appear above chat in `PinnedAnnouncement` style.

#### Smart link release page (release detail)

Hero with cover art (gradient placeholder using the cover palette), title, artist handle, EP/album/single + track count + year.

Below: a quote card with brand-border-left and italic text. Optional — not all releases have one.

Below: 4-6 DSP buttons in a list. Each row: platform icon + name + short verb ("Stream" / "Buy / Free DL" / "FLAC · best quality") + arrow.

Pre-release variant: same hero, but instead of DSP buttons, a countdown card (`DAYS / HRS / MIN`) and "Get notified" email input.

Footer: "Powered by tahti.eu · @<handle>" — very small.

#### 24/7 channel view (always-on)

This is the offline state of a channel. The artist isn't broadcasting live, but:
- Archive plays automatically
- Countdown to next live broadcast (HRS / MIN / SEC / day-of-week)
- "ARCHIVE — ALL BROADCASTS" list of every past broadcast
- "Set a reminder" link on the upcoming broadcast (sends email when artist goes live)

This is the **default state** of any channel without an active broadcast. The "channel is silent" state should never appear unless the artist explicitly takes their channel offline.

#### Private Stash (`/app/stash`) — membership only

WIP file storage with sharing controls. Visible to member artists only.

Components:
- Quota header: "Private storage · 4.2 GB used of 20 GB · Paid plan"
- File list: each row has lock icon (locked = private), filename, format/bitdepth/size, last modified, comment count
- Per-file actions: Play (if playable format), Share link, Download
- "Shared Access" panel: list of people who have access to specific files. Each entry: avatar, handle, permission (Read-only / Download), expiry, Revoke button
- "+ Upload" + "Share folder" actions at top

This is a high-trust feature for serious users — mastering engineers, label A&R, collaborators on a track. The auth model: shared links are signed URLs that can be revoked. Documents in this view are NEVER public, NEVER indexed by the engagement-unit ledger, NEVER counted toward downloads.

---

## Phase 2: User journey audit

For each persona, document the canonical journey. Compare against current implementation. Any page in the journey that is currently a stub or 404 is a gap to close.

### 2.1 Listener journey (anonymous)

```
Land on tahti.eu  →  Discover     (homepage with "on air right now")
                  ↓
                  Click an artist tile
                  ↓
                  Listen → Channel page (LIVE or always-on state)
                       ↓
                       Browse archive
                       ↓
                       Click a release
                       ↓
                       Release smart link page (open Spotify / Bandcamp / etc.)
                  ↓
                  OR click "Support directly" →  Subscribe page
                                                ↓
                                                Stripe Checkout
                                                ↓
                                                Account created → Supporter badge
```

**Pages required for this journey:**

| Route | Status check |
|---|---|
| `/` | Homepage with hero, "On air right now" tile grid, stats strip, CTA to /signup |
| `/u/<handle>` | Public artist profile per screenshot 3 |
| `/<handle>` or `<handle>.tahti.eu` | Live channel page per screenshot 4 (live state) OR screenshot 8 (24/7 state) |
| `/r/<release>` | Release smart link page per screenshot 2 |
| `/r/<release>/embed` | oEmbed widget for the release (separate route, ~25 KB total page weight) |
| `/u/<handle>/embed` | oEmbed widget for the channel |
| `/u/<handle>/subscribe` | Fan-sub purchase page (tier cards + Stripe Checkout) |
| `/radio` (or `radio.tahti.eu`) | Tahti Radio meta-stream page |
| `/venues` | Public venue directory |
| `/v/<slug>` | Venue profile + calendar |
| `/about` | About the org, mission, the constitution |
| `/for-artists` | Marketing page targeting artists with the design carousel from screenshot 4 (Channel Page / Artist Dashboard / Mobile / etc. tabs) |
| `/transparency` | Public ledger, financial reports, grant distribution history |
| `/agpl` | Source code links, license, "you can fork this" page |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

**Subjourneys to verify:**

- Anonymous listener → fan-subscriber:
  - Click "Support €5/mo" on channel page or profile
  - Lands on `/u/<handle>/subscribe`
  - Selects tier
  - Stripe Checkout (hosted)
  - Returns to `<handle>` with confirmation toast + supporter badge active
  - Confirmation email sent
  - Listener now has an account they can sign into (passwordless or with password)

- Anonymous listener → discovery:
  - From `/` clicks "Radio" → lands on Tahti Radio
  - Hears currently-relayed broadcaster → clicks "Tune in" → goes to their channel
  - From channel page sees `@-mention` of another artist → clicks → goes to mentioned artist's profile

### 2.2 Artist journey (authenticated)

```
Sign up at tahti.eu  →  Onboarding (slug, payment, profile basics)
                    ↓
                    Dashboard landing
                       ├─→  Channel (manage current state, see stream keys)
                       ├─→  Stats (engagement units, plays, top tracks, top countries)
                       ├─→  Archive (upload, edit existing, audio editor)
                       ├─→  Revenue (fan-sub income, distribution income, grant estimate)
                       ├─→  Newsletter (compose, send, list management)
                       ├─→  Smart Links (release pages)
                       ├─→  Distribution (DSP submissions via Revelator)
                       ├─→  Stash (paid only)
                       └─→  Settings (account, payments, fan-sub tiers, withdrawal)
```

**Pages required for this journey:**

| Route | Persona | Status |
|---|---|---|
| `/signup` | anon | Email + handle picker + tier select |
| `/signup/payment` | new artist | Stripe Checkout (€40/year or skip-to-free) |
| `/signup/profile` | new artist | Avatar, bio, location, genre tags, externals |
| `/signup/broadcast` | new artist | Brief broadcasting setup walkthrough |
| `/dashboard` | artist | Channel overview, screenshot 5 |
| `/dashboard/channel` | artist | Same as `/dashboard` or aliased — main channel control surface |
| `/dashboard/stats` | artist | Screenshot 1 |
| `/dashboard/archive` | artist | Archive list + upload |
| `/dashboard/archive/<id>` | artist | Single archive item detail |
| `/dashboard/archive/<id>/edit` | artist | Audio editor (trim, tracklist, metadata, fade) |
| `/dashboard/revenue` | artist | Income breakdown, payout history, grant estimate |
| `/dashboard/newsletter` | artist | Newsletter list + draft history |
| `/dashboard/newsletter/compose` | artist | Compose new newsletter |
| `/dashboard/newsletter/sent/<id>` | artist | Sent newsletter analytics |
| `/dashboard/smart-links` | artist | List of releases with their smart link URLs |
| `/dashboard/smart-links/new` | artist | Create new release smart link |
| `/dashboard/distribution` | artist | DSP submission queue |
| `/dashboard/distribution/new` | artist | Submit new release to DSPs |
| `/dashboard/settings` | artist | Account |
| `/dashboard/settings/profile` | artist | Public profile editor |
| `/dashboard/settings/channel` | artist | Channel display name, slug, custom domain |
| `/dashboard/settings/broadcast` | artist | Stream keys (RTMP + Icecast), test connection |
| `/dashboard/settings/payments` | artist | Stripe Connect setup, payout schedule |
| `/dashboard/settings/fan-subs` | artist | Configure fan-sub tiers (Supporter €3, Backer €5, Patron €10, custom) |
| `/dashboard/settings/notifications` | artist | Email preferences |
| `/dashboard/settings/billing` | artist | Tahti subscription status, invoices |
| `/app/stash` | member artist | Screenshot 9 |
| `/app/stash/upload` | member artist | Upload to stash |
| `/app/stash/<file-id>` | member artist | File detail + comments + share controls |

**Subjourneys to verify:**

- Free artist → paid:
  - Free artist hits weekly broadcast cap (1 hour)
  - Sees gentle banner: "your weekly hour is up — channel returns to archive, reset Monday"
  - Visits `/dashboard/settings/billing`
  - Clicks "Upgrade to Tahti" → Stripe Checkout → returns paid
  - Sidebar updates: Stash item appears, multistream destinations unlocked, FLAC streaming enabled

- Artist goes live:
  - From `/dashboard/channel`, sees "Go Live" or "Test Connection" affordance
  - Configures OBS/Mixxx/Traktor with displayed RTMP or Icecast credentials
  - Starts broadcasting from their tool
  - Dashboard shows "BROADCASTING NOW" status bar
  - Listeners arrive (counter goes up)
  - Artist ends broadcast → auto-archive job runs → shows up in archive within ~2 min
  - Optionally artist clicks "Edit" on the just-archived item → audio editor → trim + tracklist + save

- Artist drafts and sends newsletter:
  - `/dashboard/newsletter/compose` → markdown editor with live preview (split view)
  - Subject line, body, optional CTA button
  - Send rate-limited (max 4 per week per artist)
  - Sent record appears in `/dashboard/newsletter` with delivery + open metrics

### 2.3 Admin journey (director + board members)

Different role. The admin views are NOT in the v8 screenshots — you'll need to design them following the same visual language. They live under `/admin/*`.

```
Sign in as admin  →  /admin (director dashboard)
                  ├─→  Members (search, verify, suspend, GDPR handling)
                  ├─→  Venues (verification queue)
                  ├─→  Financials (monthly close, year-end audit prep)
                  ├─→  Grants (annual calculation review, distribution)
                  ├─→  Ledger (transparency dashboard backstage)
                  ├─→  Support (escalation queue from fan-sub disputes, abuse reports)
                  └─→  Settings (org-wide configuration, vendor management)
```

**Pages required for admin journey:**

| Route | Required for | Status |
|---|---|---|
| `/admin` | Director, board | Org-wide KPIs: members, revenue, runway, grant pipeline status |
| `/admin/members` | Director | Search, filter, view artist accounts |
| `/admin/members/<handle>` | Director | Single-member admin view, suspension controls, support history |
| `/admin/venues` | Director | Verification queue for venue submissions |
| `/admin/venues/<id>` | Director | Single-venue admin view |
| `/admin/financials` | Director, board, treasurer | Monthly P&L, cash position, vendor spend |
| `/admin/grants` | Director, board | Engagement-unit calculation review, distribution approval flow |
| `/admin/grants/<year>` | Director, board | Specific year's grant cycle |
| `/admin/ledger` | Director | Admin view of the public ledger (with un-redacted member identities for auditing) |
| `/admin/support` | Director, support contractor | Ticket queue: fan-sub disputes, copyright claims, abuse reports |
| `/admin/support/<ticket>` | Support | Single ticket detail |
| `/admin/board` | Board only | Board minutes, motions, votes |
| `/admin/settings/vendors` | Director | UpCloud, Stripe, Postmark, Revelator config + DPA tracking |
| `/admin/agm` | Board, members (read) | AGM planning + proposal management |

**Admin design notes:**

The admin pages use the same design language as the artist dashboard, with two visible differences:

1. A persistent yellow strip across the top: `"ADMIN VIEW · acting as [name]"` so admins never forget they're in elevated context.
2. The sidebar shows admin sections instead of artist sections.

Admin views are not "luxury features" — they're operational necessities. The director will use these every week. Build them with the same care as artist views.

---

## Phase 3: Implementation plan (priority order)

Don't try to do everything at once. Work in this order:

### 3.1 Foundation (week 1-2)

1. **Tokens locked down**: All colors, type sizes, spacing, radii in Tailwind config or CSS variables. No hardcoded hex in any component.
2. **Base components built**: BrowserFrame, StatCard, BroadcastStatusBar, PinnedAnnouncement, ChatPanel, SidebarNav, CoverArtTile, AvatarTile, ReleaseTile, ActionButton, DSPLinkButton.
3. **Layout shells built**: PublicShell (homepage, profile, release pages), DashboardShell (artist authenticated), AdminShell (admin).

After this phase, you have building blocks but no completed pages.

### 3.2 Listener pages (week 2-3)

In this order:
1. `/` (homepage)
2. `/u/<handle>` (public artist profile)
3. `/<handle>` channel page in live state
4. `/<handle>` channel page in 24/7 state (offline)
5. `/r/<release>` smart link page (published + pre-release variants)
6. `/u/<handle>/subscribe` (fan-sub page)
7. `/radio` (Tahti Radio)
8. `/venues` + `/v/<slug>` (venue pages)
9. About, for-artists, transparency, agpl, privacy, terms

After this phase, the public-facing product is complete.

### 3.3 Artist authenticated pages (week 3-5)

In this order:
1. `/dashboard` (channel overview — the main landing)
2. `/dashboard/stats`
3. `/dashboard/archive` + `/dashboard/archive/<id>` + `/dashboard/archive/<id>/edit`
4. `/dashboard/settings/broadcast` (stream keys, test connection)
5. `/dashboard/newsletter` + `/dashboard/newsletter/compose`
6. `/dashboard/smart-links` + `/dashboard/smart-links/new`
7. `/dashboard/revenue`
8. `/dashboard/distribution`
9. `/dashboard/settings/*` (all settings sub-pages)
10. `/app/stash` (paid only)
11. Signup flow (`/signup` → `/signup/payment` → `/signup/profile` → `/signup/broadcast`)

After this phase, the artist product is complete.

### 3.4 Admin pages (week 5-6)

All `/admin/*` routes.

### 3.5 Polish and integration (week 6+)

- Loading states for every async surface
- Empty states for every list (artist with no archive yet, listener exploring a brand-new channel, etc.)
- Error states for failures (broadcast won't start, Stripe Checkout fails, distribution rejected)
- Mobile responsiveness verified against screenshot 6
- Keyboard navigation throughout
- Screen-reader announcements for LIVE state changes, broadcast end, support messages received
- Reduced-motion support for the pulsing LIVE dot, waveform animations, countdown

---

## Phase 4: Verification

For each completed page, run this checklist:

- [ ] Visual matches the mockup (compare side-by-side if a mockup exists; if not, follows the design language)
- [ ] No hardcoded colors — all use tokens
- [ ] Uses base components (no one-off StatCard reimplementation)
- [ ] Has loading state, empty state, error state
- [ ] Mobile-responsive (test at 375px width)
- [ ] Keyboard-navigable (tab through all interactive elements)
- [ ] Screen-reader friendly (semantic HTML, aria-labels where needed)
- [ ] Respects `prefers-reduced-motion`
- [ ] All user-visible strings are sentence case (not title case)
- [ ] No marketing-voice text ("amazing", "revolutionary", "leverage", "premium experience")
- [ ] Performance: page weight under 200KB JS for public pages, under 500KB for dashboard pages

For each completed user journey:

- [ ] Walk through the journey end-to-end from a fresh browser session
- [ ] Every step lands on a real page, not a 404 or "Coming soon"
- [ ] Transitions feel coherent (consistent header, sidebar, tone)
- [ ] No design-language whiplash (one page modern dark, next page light Nordic)
- [ ] All affordances visible from the screenshot are present and functional

---

## Anti-patterns — do not do these

1. **Do not** reintroduce hardcoded colors. If you find yourself writing `#0F6E56` or `#FFB840` in a component, stop and add a token.
2. **Do not** add a "Recommended for you" or "Trending" or "Most played" rail. The constitution forbids algorithmic surfacing.
3. **Do not** add Tahti-branded interruptions in the listener flow. The artist's brand is the headline; Tahti is the plumbing.
4. **Do not** add a "Listener Premium" / "Tahti Plus" tier for listeners. Listeners pay artists directly via fan-subs. They do not pay Tahti.
5. **Do not** put advertising of any kind in the player or channel pages. Constitution Rule 1.
6. **Do not** track listeners with cookies or fingerprinting beyond what's strictly required (rotating IP hash for chat moderation, that's it).
7. **Do not** add page transitions, page-load splashes, or marketing-site animations. The product is a tool, not a brochure.
8. **Do not** use Lottie animations, custom WebGL backgrounds, or any decorative motion. The pulsing LIVE dot is the only animation in the product.
9. **Do not** introduce a new design language for admin pages. Same tokens, same components, with the admin context strip.
10. **Do not** "improve" the Mac browser-frame chrome by adding a forward/back/refresh button row. It's deliberately minimal — three dots and a URL.
11. **Do not** show listener counts as the headline metric for an artist. Listener count is a vanity number per the constitution. Use *engagement units* in any prominent position (grant estimate uses listener-hours only as input to the engagement formula).
12. **Do not** auto-play audio when the listener arrives. Click-to-play is non-negotiable for accessibility and respectful UX.

---

## Working notes

### On the URL routing question

The screenshots show two different patterns for channel pages:
- `dj-moonrise.tahti.fi` (subdomain) — screenshot 4
- `tahti.fi/neon-ghost` (path) — screenshots 7 and 8

Both should work. Subdomain is the canonical artist URL (better for sharing, more memorable); path-based is the fallback when subdomain isn't configured. Use `next.config.js` rewrites or middleware to route `*.tahti.eu` to the same channel handler as `/[handle]`.

For the marketing site and authenticated dashboard, use only `tahti.eu/*` paths — never subdomains.

### On the domain change

The screenshots show `tahti.fi`. The current domain is `tahti.eu` (Long renamed in a prior session because `.fi` was taken). Update all `tahti.fi` references in:
- Component literals (especially URL displays in `<BrowserFrame>` mockups)
- Marketing copy
- Email templates
- OG/Twitter card images
- `next.config.js` (allowed image hosts, etc.)

Do not "future-proof" by using an env var here. Just use `tahti.eu`. If the domain changes again, it's a one-line sed.

### On the audio backend

The mockups show FLAC streaming with LOSSLESS / FLAC badges. Verify that:

1. The audio ingest stack accepts and preserves FLAC source (Liquidsoap config in `infra/liquidsoap-channel.liq.template`)
2. The streaming output for member artists actually serves FLAC (HLS with FLAC segments, or Icecast2 with FLAC mount)
3. Free channels serve MP3 192 only
4. The frontend correctly displays the badge that matches the actual stream

Do not display LOSSLESS / FLAC if the audio is actually being downsampled to Opus or MP3 silently. That's a Rule 2 violation.

### On the audio editor (`/dashboard/archive/<id>/edit`)

The previous mockup set (from before this session) showed a trim view and tracklist view with ACRCloud track identification. That feature is correct but its design needs updating to v8.

Build the audio editor with:
- Waveform display using WaveSurfer.js (current version, MIT licensed)
- Trim sliders that operate on the source FLAC non-destructively (output a new derivative; preserve original)
- Tracklist with timestamps + ACRCloud-suggested track names (artist confirms or corrects)
- Metadata fields: title, genre, mood, recorded date, location
- Fade in/out durations (default 2s in / 4s out for live archives)
- Save publishes to: archive page, Mixcloud (if multistream destination set), tracklist into release-tile metadata

### On admin role

The admin role is held by:
- The director (one person at most times)
- Board members (3-5 people, elected)
- Support contractors (read-only access to support queue + escalation messaging)

Authorization should be role-based, not boolean. Use roles like `role:director`, `role:board`, `role:support`, `role:artist`, `role:fan-subscriber`, `role:anonymous`.

Don't put the admin pages behind a generic `isAdmin` boolean — fine-grained roles let you give a support contractor access without giving them grant-distribution approval rights.

---

## When to ask the user (Long) for input

Use `ask_user_input` or your environment's clarification mechanism if you encounter:

1. **A page that's stubbed in PR 120 but has no corresponding mockup**. Don't guess at the design — ask whether to skip, or describe what should be there in words and have him approve.
2. **A constitutional gray area**. E.g., should artists be able to see who specifically downloaded their tracks (no per Rule 3) vs aggregate download counts (yes)? When in doubt, ask before building.
3. **A vendor decision**. Postmark vs Resend, Stripe Connect Express vs Standard, Revelator vs FUGA, etc. Don't make these calls — they have legal and financial implications.
4. **Design language conflict**. If you find that one part of the codebase uses the Nordic-minimalist tokens and another uses saturated-dashboard tokens, and you're not sure which to standardize on — confirm with Long that v8 (these screenshots) wins.
5. **Real money flows**. Before pushing changes that touch Stripe Connect payouts, fan-sub billing, or grant distribution math, escalate. These are not "move fast" surfaces.

---

## Working with Long (the human)

Long is a Helsinki-based DJ + IT developer running multiple projects (Giggi, Sparkki, Tahti, Defora). He's the founder of Tahti and currently the only human in the loop on its implementation.

Working preferences:
- Honest critique over agreement
- Code delivered as downloadable files when possible, not inline blocks
- Finnish-language UX strings considered native (he's Finnish-fluent)
- Intellectual sparring welcomed — push back if a request conflicts with the constitution or with sound engineering practice
- Don't over-explain; he reads code fluently

Communication style:
- Lead with what changed and what's at stake
- Specific recommendations, not menus of choices
- Pushbacks framed concretely ("X breaks Rule 3 because Y") not abstractly ("hmm, are you sure?")

---

## Deliverable summary

When you're done with each phase, commit and open a PR with:

- **Phase 0**: PR titled "design system tokens + base components", contains tailwind config, globals.css, components/ui/* and components/tahti/*
- **Phase 1**: PR titled "listener pages v8 design" with all public routes
- **Phase 2**: PR titled "artist dashboard v8 design" with all `/dashboard/*` and `/app/*` routes  
- **Phase 3**: PR titled "admin views" with all `/admin/*` routes
- **Phase 4**: PR titled "polish + verification" with loading/empty/error states, a11y, responsive checks

In each PR description, include:
- Screenshot of every rendered page (before/after if a page existed)
- Mobile screenshot (test at 375px)
- Acceptance checklist with checks
- Open questions, if any

Reference this brief in every PR description: `Per docs/agent-brief.md, this PR delivers Phase N of the design+journey completion plan.`

---

## Final reminder

The constitution is the immutable thing. The screenshots are the visual target. This brief is the bridge between them. If anything in this brief contradicts either the constitution or a screenshot, those win.

Build with care. Long is paying for this with grant money meant for artists. Every hour you save by being precise is an hour of artist support that didn't have to come out of someone's day job.

