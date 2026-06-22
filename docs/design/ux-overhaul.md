# Tahti — UX overhaul: from generic dashboard to artist instrument

## The honest diagnosis

The app looks amateur because **every view tries to do everything**. The dashboard shows stats, stream key, recent broadcasts, and three action buttons — all at the same visual weight, with no answer to the question "what am I actually doing here?" The settings page is a wall of toggles. The channel editor is a form. Stats is a SaaS-style widget farm. There is no view in the current app where an artist looks at the screen and immediately knows what to do with their hands.

This is not a styling problem. The tokens are right, the v8 design language is correct, the mockups exist. The problem is **information architecture**: each view is a dashboard of widgets instead of a tool with one job. Restyling won't fix that. The fix is structural — re-conceive each surface around a single primary action, demote everything else, and remove the things that don't serve that action at all.

The constitution says "the artist shines brightest." Today the app does the opposite: every screen reminds the artist that they're using Tahti's product. The redesign should make Tahti's chrome quiet and the artist's own work — their stream, their releases, their channel identity — load-bearing.

## The single principle

**1 view, 1 purpose.** Every page must have exactly one job. Everything on the page either serves that job directly or is hidden until needed. Pages that violate this don't get refactored — they get split into two pages.

When an artist lands on a view, three things should happen within one second:

1. They understand what the view is for, without reading.
2. They see one obvious primary action.
3. Everything else on the page recedes visually.

If any of those three doesn't happen, the view is wrong, regardless of how the components look.

## What this means concretely

### The hero rule

Every view has a hero element that occupies the top third of the screen and communicates the view's purpose. Not a generic "Welcome back" or "Dashboard" header — a live, contextual surface that shows the current state of the thing the artist came here to manage.

- Channel home: a giant **GO LIVE** button when offline, or a giant **LIVE NOW · 47 listeners · 24:37** status when broadcasting.
- Audio editor: the waveform itself.
- Stats: this period's headline number with a clear trend, big enough to read across a room.
- Revenue: this month's earnings, color-coded, with a single explanatory sentence.

The hero is never a navigation bar or a row of stat cards. The hero is the answer to "what state is the thing in?"

### The primary action rule

Every view has one obvious primary action. It's the largest interactive element. It's in the brand cyan or a meaning-bound color. It says what it does in a verb (`Go live`, `Publish`, `Add track`, `Export`).

Supporting actions are smaller, secondary buttons. There can be at most three of them. If a view appears to need more than three actions, two of them are actually settings (move them to a settings page) or two of them are the same action with different parameters (combine them).

### The reduce rule

When in doubt, take something away. The current app over-shows: zero-stats on marketing pages, every metric on the dashboard, every toggle in settings. Each removed widget makes the remaining ones more meaningful.

A view with three things on it that all matter is more professional than a view with twelve things on it that mostly don't. The empty space is not wasted — it's what tells the artist "this thing is important, look at it."

### The instrument rule

Artist surfaces should feel like instruments, not forms. An instrument has:

- Direct manipulation (drag, click, scrub — not "submit").
- Immediate feedback (sound, motion, real-time preview).
- A sense that the artist's choices matter and have weight.
- Joyful use, not bureaucratic.

The audio editor v3.2 is already this. The channel editor, broadcasting setup, and collection editor must become this too. They should feel less like settings pages and more like Squarespace, Logic Pro, or a mixing console — tools an artist *wants* to open.

## View-by-view audit

What follows is opinionated. Implement in this order; each view is independently shippable.

### 1. Channel home (`/dashboard`)

**Current**: stat cards + stream key + recent archive + action buttons all squished together. No clear primary action.

**Job to be done**: "What's happening on my channel right now, and can I go live?"

**Redesign**:
- **Hero** (top 40% of screen, no scroll needed):
  - **Offline state**: a single large cyan card with `Go live →` button (60px tall, 18px text), brief explanation below ("Configure your broadcasting tool and start streaming"), and the current channel state line ("Last broadcast: Late Night Drift Vol. 3, 2 days ago").
  - **Live state**: green-bordered hero showing `LIVE NOW · {n} listeners · {elapsed}` in 32px display + show name + `End broadcast` warn-amber button. The hero pulses subtly (respecting prefers-reduced-motion).
- **Below the hero**: three KPI cards (this week's listeners, this month's downloads, fan-sub revenue). Three, not four — the engagement-units number belongs on the Stats page where it can be explained, not here.
- **Below that**: "Recent broadcasts" list, two items maximum, each with a single `Polish & publish →` action.
- **Removed from this page**: stream keys (move to Broadcasting Setup), action button row (Upload / Newsletter / Mixcloud — each belongs in its own focused view, surfaced via the sidebar).

The dashboard is no longer a control panel. It's a status display with one primary path forward.

### 2. Broadcasting Setup (NEW dedicated view — `/dashboard/broadcast`)

**Current**: nonexistent as a dedicated flow. Stream keys are buried in settings. Going live for the first time is a self-discovery exercise.

**Job to be done**: "Get me on air with confidence."

**Redesign**: a step-driven flow that feels like a pre-flight checklist:

- **Step 1: Your stream credentials.** Two cards (RTMP, Icecast) with copy buttons, format/server/mount info. Pre-filled, never empty.
- **Step 2: Test your signal.** A "Send test stream" affordance that shows incoming bytes, level meters (live), detected codec/bitrate, latency to ingest. Green check or specific error. Until this passes, Step 3 is locked.
- **Step 3: Pre-flight.** Show name, optional notes (pinned for chat), tags, fan-only vs public, simulcast targets toggle (if any are configured). A "Listen to my own stream" button that plays the actual outgoing audio at FLAC quality — the artist hears what listeners will hear.
- **Step 4: Go live.** Big green button. Optional 3-2-1 countdown. After click, page transitions to the live dashboard.

This page is permanent, not a one-time onboarding. Every broadcast starts here. Make it satisfying.

### 3. Channel editor (`/dashboard/settings/channel` → rename to `/dashboard/channel/edit`)

**Current**: a settings form. Tahti chrome dominates; the artist's identity is buried under field labels.

**Job to be done**: "Make my channel look like me."

**Redesign**: a customization studio with **live preview** as the dominant element.

- **Left column** (60% width): live preview of the public channel page — what listeners see at `tahti.live/{handle}` — rendering with current draft values.
- **Right column** (40% width): controls grouped by what they affect:
  - Identity: avatar (upload, replace), display name, location, pronouns, genre tags
  - Bio: 280-character bio with character counter, optional longer "about" text
  - Visual: brand color picker (constrained to v8 palette + custom), header style (solid, gradient, video loop)
  - Links: social/external (Bandcamp, Instagram, etc.)
- Changes apply to the preview within ~100 ms. No "save" required mid-edit — autosave silently. A single explicit `Publish changes` button at the top is the only commit affordance.

This is the screen that gives the artist agency over how they appear. It should feel like dressing a stage, not editing a database row.

### 4. Stats (`/dashboard/stats`)

**Current**: KPI strip + bar chart + engagement units + top tracks + top countries. SaaS dashboard cliché.

**Job to be done**: "How is my work landing?"

**Redesign**: a thoughtful one-page report, not a metrics farm.

- **Hero**: this period's headline number, in stat-plays amber, 64px tall. One sentence below in plain English: "↑ 47% vs last week — your strongest period since launch."
- **What changed**: a single narrative card explaining the delta. "Drift EP got featured by @mia.waves on Tuesday. That play accounts for most of the lift." Use real referrer/timing data; if nothing notable happened, hide the card rather than fabricate.
- **Top three**: best-performing track, best country, busiest day. Three cards, not ten.
- **Engagement units**: a calm, explanatory card with the breakdown + grant estimate. This is the constitutional number; give it space.
- **Period selector**: 7d / 30d / All. No custom date pickers unless artists actually ask.

Stats are for understanding, not for staring at. If the artist learns one thing from this page in 20 seconds, it succeeded.

### 5. Revenue (`/dashboard/revenue`)

**Current**: probably OK per the brief we wrote, but check it against this lens.

**Job to be done**: "Where's my money, and where is it going?"

**Redesign affirmation**: keep the v8 mockup direction (4 KPI cards, payout history, where-€5-goes block). Verify the "Where €5 goes" arithmetic block is present, prominent, and honest. Remove any forecasting widgets — the artist doesn't need predictions, they need today's reality.

### 6. Audio editor (`/dashboard/archive/:id/editor`)

**Current**: v3.2 spec exists; implement against the v3.2 mockup. This view is already an instrument by design. Don't redesign — implement.

### 7. Upload + Collections (`/dashboard/upload`, `/dashboard/collections`)

**Current**: per the upload+collections brief. This view is already designed around "1 view, 1 purpose" — verify implementation matches and don't drift.

### 8. Newsletter compose (`/dashboard/newsletter/compose`)

**Current**: existing two-pane editor.

**Job to be done**: "Write to my fans."

**Redesign**: the existing split editor + preview is the right pattern. Two things to tighten:

- Top: a single line stating *who will receive this* (recipient count, segments if any). Concrete: "Sending to 187 fan-subscribers + 23 newsletter-only subscribers."
- The send button: explicit, single-purpose. "Send to 210 people →". No "schedule" picker on the main view — that's a small secondary option, not a default.

### 9. Archive / catalog (`/dashboard/archive`)

**Current**: list of broadcasts, probably under-designed.

**Job to be done**: "Find a recording and do something with it."

**Redesign**: the list itself is the primary surface, but make the *actions* on each row clear and singular per row state:

- Unpublished broadcast → primary action `Polish & publish →`
- Draft → `Continue editing →`
- Published → `View on channel →` + secondary `Re-edit`

No bulk-edit, no multi-select, no toolbar of actions. One row, one obvious next move.

### 10. Settings (`/dashboard/settings/*`)

**Current**: probably one big settings page.

**Redesign**: don't have one big settings page. Split into focused sub-pages, each with a single concern:

- `/dashboard/settings/account` — email, password, language
- `/dashboard/settings/payments` — Stripe Connect, payout schedule
- `/dashboard/settings/fan-subs` — tier configuration
- `/dashboard/settings/multistream` — simulcast targets (already mocked)
- `/dashboard/settings/notifications` — email preferences
- `/dashboard/channel/edit` — channel appearance (was view #3 above)

The settings sidebar shows these as sections. Each sub-page is itself a focused view with one job. There is no `/dashboard/settings` index that tries to summarize everything — that's the kind of page that creates the "wall of widgets" feel.

## Implementation order (worst offenders first)

Ship in this order. Each ships as its own PR.

1. **Docs cleanup pass.** Delete/archive contradicting docs. Create `docs/design/README.md`. This unblocks the agent — without it, every implementation task has competing instructions.
2. **Channel home redesign.** This is the most visible page; fixing it shifts the artist's first impression.
3. **Broadcasting Setup new view.** This is the most rewarding view to make right; it changes how Tahti *feels*.
4. **Channel editor with live preview.** Differentiator. Almost no competitor has this.
5. **Stats reframe.** Less is more; this is partly deletion work.
6. **Settings split.** Mechanical refactor; do it after the high-leverage views.
7. **Archive view tightening.** Small wins.
8. **Polish pass everywhere.** Apply the smell test below to every shipped view.

## The smell test (use on every view before shipping)

Before opening a PR for any view, the agent must verify all six:

1. **The one-second test.** Show the view to someone unfamiliar with the project for one second; can they say what it's for? If no, fix.
2. **The hero test.** Is the top 40% of the screen showing the *state* of the thing being managed, not a navigation bar or header? If no, fix.
3. **The primary action test.** Is there one obviously largest, brightest interactive element with a verb label? If no, fix.
4. **The reduce test.** Try removing one element from the view. Does the view still work? If yes, remove it.
5. **The mockup conformance test.** Side-by-side with the v8 mockup at 1280px and 700px. Indistinguishable? If no, fix.
6. **The amateur sniff.** Look at it and ask: "Does this feel like an instrument or a form?" If a form, redesign.

Failing any test means the view isn't ready, regardless of whether the code is correct.

## What success looks like

A working artist opens the dashboard. Within one second they see whether their channel is broadcasting. If it's not, one prominent button takes them to the broadcasting view. That view shows credentials, accepts a test stream, lets them hear what listeners will hear, then puts them on air. Going on air feels like a moment, not like submitting a form.

They click "Channel" and see their public page rendered live, with controls beside it to change anything they want. The changes apply as they type. They publish.

They open Stats. They see one number, one sentence explaining why it's that number, and three small follow-up details. They learn something. They close the tab.

This is the bar. Every view should be designed so that closing the tab feels like the artist *got something done*, not like they navigated through an admin panel.

## Stop and ask Long

- Before deleting any doc — confirm which can go and which to archive.
- Before merging the channel-home redesign — show side-by-side screenshots of current vs proposed, get explicit sign-off.
- If the live-preview channel editor needs new APIs (it probably does) — flag scope before building.
- If the "Listen to my own stream" feature in Broadcasting Setup requires changes to the ingest pipeline — confirm before implementing.

Everything else, decide and proceed. The principle is non-negotiable. The exact rendering is yours.

---

## Docs cleanup pass — record of what was done (2026-06-21)

Archived to `docs/_archive/` (see `DEPRECATED.md` there for why):
- `design-system.2026-06-05.md`
- `style-guide.2026-06-04.md`
- `design-closing-gap.2026-06-11.md`
- `UI-brief.2026-06-20.md`

Moved into `docs/design/` (the active spec set):
- `AGENT-INSTRUCTIONS.md` (was at repo root) — v3 pixel-exact reference approach, still current.
- `ux-overhaul.md` (this file).

Referenced-but-not-yet-filed: this brief names three prior briefs — "design-reference-pack," "audio editor v3.2," "upload+collections" — that don't exist as files in the repo (likely delivered as chat content in an earlier session and never saved). `docs/audio-editor.md` is a related baseline spec but isn't the v3.2 doc. If these should be preserved as files, they need to be supplied and added here.

## Broadcasting Setup — ingest feature scope (2026-06-22)

Per "Stop and ask Long," scoped (not built) what Steps 2 and 3 of the
Broadcasting Setup flow above would require. Architecture: RTMP
(nginx-rtmp) and Icecast are the two ingest paths; on connect, the API
(`apps/api/src/routes/internal/{icecast,rtmp}.ts`) validates and hands
off to the orchestrator (`services/orchestrator/src/liquidsoap.ts`),
which spawns a per-channel Liquidsoap container
(`infra/liquidsoap-channel.liq.template`) that mixes the live input
with archive fallback and outputs HLS in two pre-baked variants —
`stream-mp3-192` (lossy) and `stream-flac` (lossless). `liveHlsUrl()`
(`apps/api/src/lib/stream-quality.ts`) currently picks the variant by
**listener tier**, not by "is this the artist."

- **Step 2, "Test your signal":** connection state, codec, and bitrate
  are genuinely free — Icecast's own `/status-json.xsl` already has
  them per-mount, it's just never parsed or exposed today (only
  polled for a binary up/down health check in
  `apps/api/src/lib/health-checks.ts`). A new API route proxying that
  JSON is UI+API-only work, no ingest change. **Live level meters and
  ingest latency are not in that JSON** — they need actual PCM
  analysis, which means a small new probe (an ffmpeg/Liquidsoap RMS
  tap, or a small sidecar reading the mount) publishing to Centrifugo
  (already used for chat presence, so the live-push transport already
  exists). This is a small, scoped ingest-side addition — not a UI
  change, but not a large one either.
- **Step 3, "Listen to my own stream" at FLAC:** the `stream-flac` HLS
  variant already exists per channel today, just gated to high
  listener tiers. No raw pre-HLS audio is exposed anywhere — every
  browser-reachable stream goes through Liquidsoap's HLS muxing. So
  the higher-quality output path already exists; this needs **no
  ingest pipeline change**, only wiring the studio preview player to
  always request `stream-flac` for the artist's own channel,
  regardless of their listener tier.

Net: Step 3 is UI-only and can be built without further confirmation.
Step 2's codec/bitrate/connection display is also UI+API-only. Step
2's live level meters and ingest-latency reading are the one piece
that's an actual (small) ingest-pipeline addition — build those last,
and separately, once the rest of the flow is in place.
