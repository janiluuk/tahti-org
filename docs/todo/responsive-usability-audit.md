# Responsive usability audit (mobile simplification)

Open implementation worklist from 2026-09-01. Audit only — **no responsive UI
changes have been made yet.** Shipped session notes (prod preflight, method) are
in `docs/todo/HISTORY.md`.

## Scope and method

Phone-first audit of the Tahti web app, using the code path and responsive CSS
for 375px and 390px viewport targets. Reviewed public discovery, home, radio,
artist/channel, player, artist studio, settings, and admin surfaces for
content density, horizontal overflow, fixed-element collisions, touch targets,
and places where desktop complexity should be progressively disclosed.

This is an audit and implementation worklist; no responsive UI changes were
made in this pass.

## Production preflight

Before the audit, production was checked because the site had been reported
broken. `tahti-stack-web-1` was reported as up/unhealthy, but the host-side
`17777` Docker proxy was absent. The Next.js process was alive and listening on
port 3000 inside the container. Restarting only that container rebuilt the
proxy; it became healthy and `17777` responded again. Local edge HTTPS probes
still returned a TLS internal alert and need a separate certificate/Caddy
follow-up before calling the public domain fully verified.

## Findings

### MOB-01 — Discover page puts too many surfaces above the primary browse task

**Priority:** P0 for mobile clarity
**Surface:** `/listen`
**Evidence:** `apps/web/src/app/listen/page.tsx:120-160`

The page loads and renders the Tahti Radio card, Your Feed, New to You, Disco
widgets, and then the Live/Replay/Selects/Artists discovery tabs. On a phone,
the actual channel browse controls are pushed below several secondary sections.
The page also fetches the complete artist directory and gallery even though the
initial viewport cannot show them.

**Work item:** Make Live the default mobile entry. Put Feed, New to You, and
widgets behind a `For you` tab or collapsed sections, and render only the first
mobile-sized page of each collection. Gate personalized requests when there is
no session. Keep server-side pagination/filtering so limiting the rendered
items also limits the payload.

### MOB-02 — Home has competing calls to action and an unexpected motion mode

**Priority:** P1
**Surface:** marketing home
**Evidence:** `apps/web/src/app/(marketing)/page.tsx:126-229` and
`apps/web/src/app/(marketing)/_idle-auto-scroll.tsx`

The hero can show beta, signup, sign-in, artist panel, and About actions. Live
channels, full news, widgets, and stats then continue as a long vertical page.
Idle auto-scroll adds motion after inactivity, which is especially surprising
on a small touch screen and can move the user away from the action they were
reading.

**Work item:** Keep one primary CTA and move the rest into a compact secondary
action. Cap the live/news previews and link to full pages. Disable idle
auto-scroll for normal mobile browsing; reserve it for an explicit kiosk/demo
mode, with a visible pause control.

### MOB-03 — Radio now has several “recent/upcoming” surfaces competing below the player

**Priority:** P1
**Surface:** `/radio`
**Evidence:** `apps/web/src/app/radio/page.tsx:247-284` and
`apps/web/src/app/radio/recently-played-channels.tsx:27-56`

The player is followed by tabbed recently played tracks/upcoming shows and a
second recently-on-air channel slider. The new channel row is correctly
horizontal, but it adds another long content block on a phone.

**Work item:** Keep the player and one “What’s next” tab visible by default.
Move track history and recently featured channels into a single `History`
surface, or make the channel slider a compact peek row with 2–3 cards and a
`See all` action. Keep cards touchable, show one line of identity plus humanized
time, and hide secondary metadata until the card opens.

### MOB-04 — Settings navigation is a wrapped desktop list, not a mobile control

**Priority:** P1
**Surface:** artist settings
**Evidence:** `apps/web/src/app/dashboard/settings/_settings-subnav.tsx:12-79`
and `packages/ui/src/styles/brand-studio.css:3656-3720`

There are more than twenty links across Profile, Security, Broadcast, Audience,
and Money. Flex wrapping creates a tall wall of pills before the focused
settings page. It also makes the active item hard to find after a scroll.

**Work item:** On mobile replace the full list with a compact current-section
selector and a `More settings` bottom sheet. Preserve the group headings inside
the sheet, keep the current page and one back link visible, and use an accordion
only where a sheet would be too deep. Do not hide unsaved-state warnings when
changing section.

### MOB-05 — System logs are technically responsive but still too dense to operate

**Priority:** P1
**Surface:** `/admin/logs`
**Evidence:** `apps/web/src/app/admin/logs/page.tsx:98-165` and
`apps/web/src/components/admin-shell.css:307-351`

The mobile layout moves the log line below the timestamp/service, but requests
up to 1,000 entries and renders a long, continuously updating monospace wall.
Search, service, follow mode, refresh, and the stream are all simultaneously
visible.

**Work item:** Default to a small recent window on mobile. Put service/search
filters behind a `Filter` sheet, make follow mode an explicit toggle with a
pause-on-scroll rule, and render each entry as a compact service/time row with
tap-to-expand details. Keep a copy action and clear empty/error states inside
the expanded row.

### MOB-06 — Generic admin tables need a deliberate card transformation

**Priority:** P1
**Surface:** admin users, status, finance, grants, AGM, storage, radio, and
governance records
**Evidence:** `apps/web/src/components/admin-shell.css:154-180` and table
surfaces returned by `rg '<table|admin-table|studio-table' apps/web/src`

The shared table wrapper permits horizontal scrolling, but scrolling a wide
table is a poor default for frequent operational tasks and hides row actions.
Financial/audit records may need a true table, while users, submissions, and
status rows are better understood as cards.

**Work item:** Classify each table. Convert operational lists to stacked cards
with a primary value, status, and one primary action; place secondary actions
under an overflow menu. Retain horizontal scrolling only for genuinely
columnar/audit data and add a visible “scroll for more” cue. Ensure long IDs,
URLs, and usernames wrap or truncate with an accessible full-value label.

### MOB-07 — Fixed player and bottom navigation require a shared safe-area contract

**Priority:** P1
**Surface:** all listening and studio routes
**Evidence:** `apps/web/src/app/globals.css`,
`packages/ui/src/styles/brand-channel.css`, and
`packages/ui/src/styles/brand-studio.css:3445-3468`

The app can combine a fixed mini-player, fixed channel controls, and the studio
bottom navigation. Individual surfaces have responsive rules, but there is no
single audited contract proving that the last content/action remains above the
largest combined fixed stack. This risks obscured buttons and chat inputs,
especially with an iOS safe-area inset.

**Work item:** Define one shared mobile fixed-stack height token and apply it to
page bottom padding. Test with mini-player + bottom nav + keyboard open. Keep
titles to one line with an expand affordance and avoid placing destructive
actions at the bottom edge.

### MOB-08 — Artist/channel pages should collapse secondary content on entry

**Priority:** P1
**Surface:** public artist and channel pages
**Evidence:** `packages/ui/src/styles/brand-channel.css` contains multiple
mobile overflow/scroll regions, fixed overlays, and dense archive/chat rules.

The public channel experience combines identity, artwork, live/replay state,
player controls, timeline/comments, archive, links, and chat. On a phone these
compete for vertical space and make the primary listen action easy to lose.

**Work item:** Establish a mobile order of identity → primary player → one
contextual action row → content tabs. Collapse links, archive metadata, and
long descriptions behind `About`/`More`; keep chat as a tab or bottom sheet
rather than a simultaneously competing column. Verify replay/live labels stay
visible next to the player state.

### MOB-09 — Long chip rows and wide controls need intentional overflow behavior

**Priority:** P2
**Surface:** discovery filters, studio navigation, timeline tools, and admin
controls
**Evidence:** responsive searches found many `white-space: nowrap`, `min-width`,
and `overflow-x: auto` rules in `apps/web/src` and `packages/ui/src`.

Some horizontal scrolling is appropriate for card rails, but filters and action
controls should not silently become inaccessible sideways scroll areas.

**Work item:** Use the “peek” pattern only for content rails: partial next card,
scroll snap, hidden scrollbar, and an accessible label. For filter chips, show
the active filter plus a `Filters` button that opens a sheet. Add
`min-width: 0`, `overflow-wrap: anywhere`, and truncation to flex/grid children
where long labels can widen the page.

### MOB-10 — Complex forms should become progressive disclosure flows

**Priority:** P2
**Surface:** upload, channel identity, broadcast, integrations, and admin
editors
**Evidence:** existing uploader/editor surfaces under
`apps/web/src/app/dashboard` and `apps/web/src/app/admin`.

Multi-field forms are readable on desktop but become long, error-prone scrolls
on a phone, especially when previews, advanced options, and destructive actions
are all expanded.

**Work item:** Divide forms into short steps or named disclosure sections:
Essentials, Media, Distribution, Advanced. Keep one sticky primary action,
show validation beside the field, defer previews/advanced controls until
requested, and use a confirmation sheet for destructive operations.

## Mobile simplification rules to apply consistently

1. One primary task and one primary action per viewport.
2. Default to the smallest useful dataset; load more intentionally.
3. Use tabs for peer content, accordions for secondary detail, and bottom
   sheets for filters/actions that would otherwise consume the page.
4. Use horizontal scroll for cards, not for essential controls or row actions.
5. Collapse metadata before hiding identity, state, or error feedback.
6. Preserve touch targets of at least 44px, visible focus, Escape/backdrop
   dismissal for sheets, and safe-area padding for fixed controls.
7. Pause live-following content when the user scrolls or focuses an input.
8. Test 320px as a failure boundary even if 375px is the supported baseline.

## Suggested implementation order

1. Fix the shared fixed-stack/safe-area contract and public channel primary
   action (MOB-07/MOB-08).
2. Simplify `/listen` and `/radio` above-the-fold content (MOB-01/MOB-03).
3. Replace settings and log controls with mobile selectors/sheets
   (MOB-04/MOB-05).
4. Classify and transform admin tables (MOB-06).
5. Remove normal mobile auto-scroll and reduce home previews (MOB-02).
6. Apply the overflow and progressive-disclosure rules to remaining forms and
   toolbars (MOB-09/MOB-10).

## Verification checklist for implementation

- Check 320, 375, 390, and 430px widths with no horizontal document overflow.
- Test anonymous, artist, moderator, and board/admin sessions.
- Test portrait rotation, browser zoom at 200%, keyboard open, and iOS safe
  area behavior.
- Test touch-only use: no hover-dependent disclosure, 44px targets, and clear
  swipe/scroll affordances.
- Test reduced motion and confirm live-following views pause when interacted
  with.
- Capture route smoke checks for `/`, `/listen`, `/radio`, `/u/[username]`,
  `/dashboard/settings/*`, and `/admin/*` after implementation.
