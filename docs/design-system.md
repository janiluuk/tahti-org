# Tahti design system

Extracted from the live codebase for use as a portable design reference. An engineer applying this to a different project should be able to produce a coherent UI without consulting Tahti's source.

**Extracted:** 2026-06-05  
**Sources of truth:**
- Brand (dark) tokens: `packages/ui/src/tokens.css`
- Brand components: `packages/ui/src/components.css`
- Admin (light) tokens: `apps/web/src/components/ui/tokens.css`
- Admin components: `apps/web/src/components/ui/ui.css`
- Machine-readable: `docs/design-tokens.json`

---

## Design philosophy

**Dark as the default working environment.** Tahti is used by DJs running long sets, sound engineers checking signal levels, artists monitoring live listener counts at 2am. A light background introduces eye strain and washes out the visual contrast you need to read numbers quickly. The deep navy background (`#0a0f1e`) is specifically chosen for its cinema-like quality — saturated enough to feel intentional, dark enough to make bright content pop cleanly.

**Bright accent colors as instrument readouts, not decoration.** The four primary stat colors — amber for plays and money, cyan for technical metrics, green for live state, purple for community/subscriptions — are functionally distinct. A working DJ glancing at the dashboard knows at a glance what color means what, the same way studio monitors use different colors for signal-present versus clipping. Using purple decoratively on a non-community feature, or amber as a general highlight, erodes this readability. The colors carry meaning; treat them as reserved.

**Broadcasting green is non-negotiable.** Green = live/safe-to-go is a cultural convention inherited from broadcasting hardware and stage production. Red = danger/recording. This convention predates software and lives in the muscle memory of anyone who has worked in a studio or on stage. Tahti's `--green: #00e676` is never used for anything except live/broadcasting state. Using it for "success" on a save action, or for a positive stat, would slowly corrupt its meaning.

**The artist shines brightest (CONSTITUTION Rule 3).** Every page-layout choice reinforces this. The Tahti wordmark is small, uppercase, no logo mark — it is deliberately deferential. On the channel page, the artist's name is the largest text. Cover art gets prominent placement in archive lists. The sidebar nav groups things from the artist's perspective (their channel, their releases, their community) — not from Tahti's perspective (features, tiers, upgrades). When in doubt: who does the visual hierarchy serve? If it's Tahti, reconsider.

**Restraint in motion.** The animation vocabulary is limited to three speeds: `0.2s ease` for hover state changes, `0.3s ease` for card lifts, `0.7s ease` for scroll-reveal entrances. The broadcasting pulse animation (live dot) runs at `1.5s ease-in-out` — slow enough to feel like a heartbeat, not a spinner. Glassmorphism, gradient backgrounds, parallax, animated illustrations, and autoplay sound are all absent by design. The product's content — the music, the numbers, the text — is the motion.

---

## Two surfaces

Tahti has two distinct design surfaces that share the same brand identity but use different visual registers:

| Surface | Where | Tone | Token prefix |
|---------|-------|------|--------------|
| **Brand** | Marketing site, public channel/profile/smart-link pages | Dark navy, saturated accents | `--` (e.g. `--amber`) |
| **Studio** | Authenticated dashboard (`/dashboard`) | Dark navy (migrating from light admin) | `--` + `brand-studio.css` |
| **Admin forms** | Panels/fields inside dashboard and mixed pages | Light tokens for legacy form chrome | `--tahti-` (e.g. `--tahti-primary`) |

**Single library:** All React components live in `packages/ui` (`@tahti/ui`). CSS lives under `packages/ui/src/styles/`. `apps/web/src/components/ui` re-exports the package — never duplicate implementations there.

The brand surface uses `@tahti/ui` brand shells and marketing primitives. The admin surface uses `@tahti/ui` admin components (`Button`, `Panel`, …). They share fonts and brand color aliases but use different token prefixes until the dashboard migration completes.

> **Implementation note:** The admin dashboard at `/dashboard` is currently implemented with the light token system. The mockups embedded in the marketing site (visible in `website/screenshots/`) show the intended dark-theme admin design — that migration has not yet been completed. This document describes both what is built and what is intended; the dark brand surface is canonical for visual identity.

---

## Color tokens

### Brand layer (dark surface) — swappable per project

All declared in `packages/ui/src/tokens.css`.

| Token | Hex | Role |
|-------|-----|------|
| `--bg` | `#0a0f1e` | Page background — deep navy |
| `--card` | `#111827` | Card / panel surface |
| `--card2` | `#1a2340` | Elevated card, callout, stat cell |
| `--amber` | `#f0a500` | Primary CTA · wordmark accent · key metric values · grant figures |
| `--cyan` | `#00bcd4` | Streaming · player controls · tech metrics · sidebar active state |
| `--green` | `#00e676` | Live/broadcasting state · positive status indicator (reserved — see philosophy) |
| `--purple` | `#7c4dff` | Fan subscriptions · community governance · cooperative features |
| `--coral` | `#ff6b6b` | Errors · destructive actions |
| `--lavender` | `#9c88ff` | Membership status · artist handle decoration · grant context |
| `--text` | `#e8eaf6` | Primary text |
| `--muted` | `#8892a4` | Secondary text · labels · captions · metadata |
| `--border` | `rgba(255,255,255,0.07)` | Default border |
| `--border-hover` | `rgba(255,255,255,0.15)` | Hovered border |
| `--sidebar-bg` | `#0d1626` | Sidebar background (slightly darker than `--bg`; applied inline, not declared as token) |

**To apply to a different brand:** Replace `--amber` (primary brand color) and optionally adjust `--bg`/`--card`/`--card2`. If the new brand has a specific live/broadcasting semantic, evaluate whether to keep `--green` or substitute — but read the philosophy section first.

### System layer (stable across projects) — do not swap

| Color | Hex | Why it's fixed |
|-------|-----|----------------|
| `--green` `#00e676` | Live/broadcasting | Broadcasting-hardware convention. Changing it would confuse artists who have worked with hardware |
| `--coral` `#ff6b6b` | Destructive/error | Warm red for danger carries universal meaning. Must remain distinct from amber |

### Admin layer (light surface)

All declared in `apps/web/src/components/ui/tokens.css` with `--tahti-` prefix.

| Token | Hex | Role |
|-------|-----|------|
| `--tahti-bg` | `#fafafa` | Page background |
| `--tahti-surface` | `#ffffff` | Panel / card surface |
| `--tahti-surface-muted` | `#f5f5f5` | Muted surface, disabled input |
| `--tahti-border` | `#e5e7eb` | Default border |
| `--tahti-border-strong` | `#d1d5db` | Input border |
| `--tahti-text` | `#111827` | Primary text |
| `--tahti-text-secondary` | `#374151` | Form labels, secondary copy |
| `--tahti-text-muted` | `#6b7280` | Hints, captions |
| `--tahti-primary` | `#2563eb` | Primary action buttons, links |
| `--tahti-primary-hover` | `#1d4ed8` | Button hover |
| `--tahti-success` | `#16a34a` | Success state text |
| `--tahti-error` | `#dc2626` | Error text, LIVE badge |
| `--tahti-warning` | `#d97706` | Warning text |
| `--tahti-warning-border` | `#fbbf24` | Warning panel border |
| `--tahti-info` | `#0284c7` | Info text |

Brand colors are mirrored as `--tahti-brand-amber: #f0a500`, `--tahti-brand-cyan: #00bcd4`, etc. — used when admin pages need brand-colored elements.

---

## Typography

### Fonts

Loaded via `next/font/google` in `apps/web/src/app/layout.tsx`. CSS variables injected as `--font-inter` and `--font-space-grotesk` on `<html>`.

| Role | Family | CSS token (brand / admin) |
|------|--------|---------------------------|
| Display / headings | Space Grotesk | `--font-head` / `--tahti-font-display` |
| Body / UI copy | Inter | `--font-body` / `--tahti-font-body` |
| Monospace | SF Mono → Fira Code → Fira Mono → system | `--font-mono` / `--tahti-font-mono` |

No custom `font-feature-settings` are declared. Tabular numerals are not set in the token files — the transparency page applies `fontVariantNumeric: 'tabular-nums'` as an inline style on individual number spans.

### Type scale (admin surface)

| Token | rem | px | Used for |
|-------|-----|----|---------|
| `--tahti-text-xs` | 0.75 | 12 | Badges, hints, copy-row labels |
| `--tahti-text-sm` | 0.875 | 14 | Secondary body, table metadata |
| `--tahti-text-base` | 1.0 | 16 | Default body text |
| `--tahti-text-lg` | 1.125 | 18 | `<Heading level={3}>` |
| `--tahti-text-2xl` | 1.5 | 24 | `<Heading level={2}>` |
| `--tahti-text-3xl` | 1.875 | 30 | `<Heading level={1}>` |

### Type scale (brand/dark surface)

Marketing headings use `clamp()` for fluid scaling; UI elements use fixed sizes.

| Element | Size | Weight | Notes |
|---------|------|--------|-------|
| Section heading (`.s-h2`) | `clamp(32px, 5vw, 58px)` | 700 | Space Grotesk |
| Section subtitle (`.s-sub`) | `clamp(18px, 2.5vw, 28px)` | 300 | Italic, accent color |
| Section label (`.s-label`) | 11px | — | Uppercase, 4px letter-spacing, `--muted` |
| Section lead (`.s-lead`) | 16px | — | Inter, 1.7 line-height |
| Stat value (`.stat-value`) | 26px | 700 | Space Grotesk |
| Stat label (`.stat-label`) | 11px | — | 0.5px letter-spacing |
| Card title | 16px | 600 | Space Grotesk |
| Card body | 14px | — | `--muted`, 1.6 line-height |
| Callout label | 10px | 600 | Uppercase, 3px letter-spacing |
| Price number (`.price-num`) | 56px | 700 | Space Grotesk |
| Nav wordmark | 18px | 700 | 4px letter-spacing, uppercase |
| Form label | 11px | 600 | Uppercase, 1.5px letter-spacing |

### Weight rules

Weights used in the codebase: **300** (italic subtitle), **400** (body default), **600** (subheadings, labels, badges), **700** (display headings, stat values, price numbers). Weight 500 is not used.

### Letter-spacing conventions

- Section labels, form labels, badge text: uppercase with 1–4px letter-spacing
- Nav wordmark: 4px — the widest in the system
- Stat labels: 0.5px (non-uppercase)
- Body text: none (default)

---

## Spacing and layout

### Spacing scale

4px base grid. Admin tokens: `--tahti-space-N`. Brand surface uses the same rhythm applied directly.

| Steps | Value | px |
|-------|-------|----|
| 1 | 0.25rem | 4 |
| 2 | 0.5rem | 8 |
| 3 | 0.75rem | 12 |
| 4 | 1rem | 16 |
| 6 | 1.5rem | 24 |
| 8 | 2rem | 32 |
| 10 | 2.5rem | 40 |
| 12 | 3rem | 48 |

### Container widths

| Context | Max-width | Component |
|---------|-----------|-----------|
| Auth, verify, narrow public | 640px | `<PageShell size="sm">` / `.brand-public--center` |
| Dashboard, forms | 960px | `<PageShell size="md">` |
| Channel page, wide grids | 1100px | `<PageShell size="lg">` / `.section-inner` |

### Card padding

- Brand card (`.card`): 24px all sides
- Brand stat cell (`.stat`): 16px all sides
- Brand callout (`.callout`): 20px vertical, 28px horizontal
- Admin panel: 24px (`--tahti-space-6`)

### Sidebar

- Background: `#0d1626` (slightly darker than `--bg`)
- Right border: `1px solid rgba(255,255,255,0.06)`
- Item: `padding: 10px 20px`, font-size 13px, `--muted` at rest
- Active item: `background: rgba(0,188,212,0.08)` + `border-right: 2px solid var(--cyan)` + `color: var(--cyan)`
- Hover (non-active): `color: var(--text)`

### Grid system (brand surface)

```css
.grid-2 { grid-template-columns: repeat(2, 1fr); gap: 16px; }
.grid-3 { grid-template-columns: repeat(3, 1fr); gap: 16px; }
.grid-4 { grid-template-columns: repeat(4, 1fr); gap: 16px; }
```

Stat cards always render inside `.grid-4` / `<StatGrid cols={4}>`. Never render a `<Stat>` in isolation.

---

## Component patterns

### Button (brand surface)

**Code:** `packages/ui/src/Button.tsx`, styles `packages/ui/src/components.css`

| Class | Background | Text | Use |
|-------|-----------|------|-----|
| `.btn-primary` | `--amber` | `#0a0f1e` | Primary CTAs — Apply, Subscribe |
| `.btn-secondary` | Transparent | `--text` | Secondary, `rgba(255,255,255,0.18)` border |
| `.btn-sm` | `--card2` | `--text` | Compact — copy, row actions |
| `.btn-icon` | `--cyan` | `#0a0f1e` | Circular icon button (36×36px) |

Hover: primary lifts 2px + amber glow shadow. Secondary border → amber. All: `0.2s ease`.

### Button (admin surface)

**Code:** `apps/web/src/components/ui/button.tsx`

```tsx
<Button variant="primary">Save</Button>       // blue #2563eb
<Button variant="ghost" size="sm">Copy</Button>  // neutral border
<Button variant="danger">Delete</Button>      // red #dc2626
```

| Variant | Use |
|---------|-----|
| `primary` | Main save/submit/pay |
| `secondary` | Default neutral (rare; prefer ghost) |
| `ghost` | Copy key, rotate key, secondary nav |
| `danger` | Destructive |

Sizes: `sm`, `md` (default), `lg`.

### Panel (admin surface)

**Code:** `apps/web/src/components/ui/panel.tsx`

The canonical dashboard section container. Every feature area lives in its own `<Panel>`.

```tsx
<Panel title="Go Live" description="Configure your broadcast software.">
  <Stack gap={6}>
    <CopyRow label="Server" value={settings.rtmp.server} />
    <Button variant="ghost" size="sm">Rotate key</Button>
  </Stack>
</Panel>

<Panel variant="warning" title="Complete your membership">…</Panel>
```

Variants: `default` (white, gray border), `warning` (amber border, yellow-tinted bg), `success` (green border, green-tinted bg), `error` (red border, red-tinted bg).

`title` string auto-renders as `<h2>`. Optional `description` renders muted small text. Panels stack with 32px (`space-8`) top margin.

### Stat card (brand surface)

**Code:** `packages/ui/src/Stat.tsx`

```tsx
import { Stat, StatGrid } from '@tahti/ui'

<StatGrid cols={4}>
  <Stat value="1,247" label="Plays this month" accent="amber" />
  <Stat value="89"    label="Downloads"         accent="cyan" />
  <Stat value="3"     label="Fan subscribers"   accent="lavender" />
  <Stat value="€15"   label="Revenue / mo"      accent="cyan" />
</StatGrid>
```

Color convention from the mockups: plays/primary engagement → `amber`, downloads/tech → `cyan`, fan subscribers → `lavender` or `purple`, revenue → `cyan` or `amber`.

**Composition rule:** Always 2–4 cards in a `StatGrid`. Never a single isolated `<Stat>`.

### Live badge (shared)

**Code:** `packages/ui/src/Badge.tsx`

```tsx
import { LiveBadge } from '@tahti/ui'
<LiveBadge />
// → ● LIVE (pulsing green dot at 1.5s, uppercase text)
```

On the brand surface: `--green` dot. On the admin surface: the `<Badge variant="live">` uses `--tahti-live` (red `#dc2626`) because on the admin surface the LIVE badge classifies administrative state, not a safe-to-go signal.

### Broadcasting status

On the channel page (`/c/[slug]`), when offline with a scheduled broadcast:

```jsx
<div role="status" style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8 }}>
  <strong>Next broadcast</strong>
  <div>{formattedDate}</div>
</div>
```

HLS player uses `role="status" aria-live="polite"` on its loading state container.

### CopyRow (admin surface)

**Code:** `apps/web/src/components/ui/copy-row.tsx`

```tsx
<CopyRow label="Server"     value={settings.rtmp.server} />
<CopyRow label="Stream Key" value={settings.rtmp.streamKey} />
```

Anatomy: 100px label + `<Code>` monospace value (flex-grow) + `<Button variant="ghost" size="sm">`. Copy feedback: "Copy" → "Copied!" for 1500ms, then reverts. No toast.

### Card (brand surface)

**Code:** `packages/ui/src/Card.tsx`

Left-bordered content card. Hover lifts 3px via `transform: translateY(-3px)`.

```tsx
<Card accent="cyan" icon="🔊" title="HLS Player" titleAccent="cyan">
  Stream to any device via standard HLS.
</Card>
```

Left border color maps to accent token. Background: `--card`.

### Callout (brand surface)

**Code:** `packages/ui/src/Callout.tsx`

Highlighted info box. Background `--card2`, border at 30% opacity accent.

```tsx
<Callout label="Grant eligibility" variant="amber">
  Your engagement units qualify for the Year 2 grant pool.
</Callout>
```

Variants: `amber` (default), `cyan`, `green`, `purple`.

### Alert (admin surface)

**Code:** `apps/web/src/components/ui/alert.tsx`

Inline feedback. Default `role="alert"`.

```tsx
<Alert variant="error">Something went wrong.</Alert>
<Alert variant="success">Changes saved.</Alert>
<Alert variant="warning">Email not yet verified.</Alert>
<Alert variant="info">This action is irreversible.</Alert>
```

No toast library exists. All feedback uses inline `<Alert>`.

### Field / Form pattern (admin surface)

**Code:** `apps/web/src/components/ui/field.tsx`

```tsx
<Field label="Stream title" htmlFor="title" hint="Shown in the archive after broadcast.">
  <Input id="title" placeholder="Helsinki Winter Session" />
</Field>

<Field label="Notes">
  <Textarea rows={4} mono />
</Field>
```

Label: 14px, weight 600, `--tahti-text-secondary`. Hint: 12px `--tahti-text-muted` below input. Focus: `border-color: --tahti-primary` + `--tahti-focus-ring` box-shadow.

### Quality badge (brand surface)

**Code:** `packages/ui/src/Badge.tsx`

```tsx
import { QualityBadge } from '@tahti/ui'
<QualityBadge quality="FLAC" />  // cyan tinted bg, cyan text — preferred quality
<QualityBadge quality="MP3" />   // muted bg, muted text — de-emphasized
```

### Section header (brand surface)

**Code:** `packages/ui/src/SectionHeader.tsx`

```tsx
<SectionHeader
  label="FOR ARTISTS"
  heading="Your channel, always on"
  subtitle="Live when you broadcast. Archive when you don't."
  subtitleAccent="cyan"
  lead="One URL that always plays — no scheduling, no platform tax."
/>
```

Anatomy: ALL-CAPS label with amber decorative line → large fluid heading → italic colored subtitle → muted lead paragraph.

---

## Page-level layout patterns

### Marketing site shell (`website/index.html`)

Full-screen dark experience. Fixed top nav + full-viewport sections + optional Three.js WebGL background + EQ-visualization canvas.

- Nav: `rgba(10,15,30,0.85)` + `backdrop-filter: blur(12px)`, amber CTA button
- Sections: `min-height: 100vh`, `max-width: 1100px` inner content
- Background layers: Three.js canvas z-index 0, video overlay z-index 1, content z-index 10+
- Scroll reveal: `.reveal` class — `opacity: 0; translateY(40px)` → `.visible` (0.7s ease)

### Authenticated dashboard shell (`/dashboard`)

Current: light surface, no sidebar, `max-width: 960px`.

```tsx
<PageShell size="md" style={{ marginTop: '2rem', marginBottom: '2rem' }}>
  <Row between>
    <Heading level={1}>Dashboard</Heading>
    <Button variant="ghost">Log out</Button>
  </Row>
  <Text tone="secondary">Welcome back, {displayName}</Text>
  <Panel title="Your channel">…</Panel>
  <Panel title="Go Live">…</Panel>
</PageShell>
```

**Intended (mockup) shell:** Dark brand surface, left sidebar (~160px), content area. Broadcasting status bar at top of content when live. Four stat cards in 4-column grid below status bar. Stream key panel below stats. Recent archive list below. Bottom CTA row (Upload Release / Send Newsletter / Push to Mixcloud).

### Public channel shell (`/c/[slug]`)

Current: `<PageShell size="lg">` (1100px), light background, `display: grid; grid-template-columns: 1fr 340px` for content + chat sidebar.

**Intended (mockup) shell:** Dark brand surface. Artist name as large heading with live indicator + listener count. Player with waveform. Stat cells (listening now / plays / downloads). Subscribe / Download / Share buttons. Archive list below. Chat panel right.

### Public artist profile shell (`/u/[username]`)

Implemented with `class="brand-public"` — dark token set via `brand-public.css`, `max-width: 720px`. Artist name `<h1>`, handle muted, live badge if applicable, bio, releases list, collections list.

### Auth flows (`/join`, `/login`, `/verify`)

Join page uses `@/components/ui` components: `<Alert>`, `<Button>`, `<Field>`, `<Input>`, `<Stack>`. Pattern: `<PageShell size="sm">` with stacked form.

Login page currently uses minimal inline styles — flagged for migration to `@/components/ui`.

---

## Interaction patterns

### Broadcasting state transitions

| State | Visual | Color |
|-------|--------|-------|
| Idle/offline | No indicator | — |
| Upcoming | Countdown block (HRS/MIN/SEC cells), upcoming title | `--amber` numbers on `--card` bg |
| Live | `<LiveBadge />` in channel header, HLS player shows | `--green` |
| Grace period | BroadcastUsageBanner with `warningLevel === 'grace'` | Amber warning |
| Blocked | BroadcastUsageBanner with `warningLevel === 'blocked'` | Red warning |

The admin `<Badge variant="live">` uses red `--tahti-live` — different from the brand-surface green. Both are correct; they serve different audiences.

### Form submission

Pattern across dashboard panels: button `disabled` during submission, `<Alert>` rendered inline on error, `router.refresh()` on success. No toast. No optimistic UI (server values are authoritative).

### Copy to clipboard

`<CopyRow>` handles this. Feedback: "Copy" → "Copied!" for 1500ms. No toast, no animation on the value.

### Destructive action confirmation

No `<Dialog>` or confirmation modal component exists. Destructive actions are protected by button `disabled` during submission. Key rotation is single-click + loading state — no confirmation step, since the action is recoverable.

### Loading states

`<Button disabled>` + inline loading label text ("Rotating…", "Processing…") is the standard pattern. No spinner component. No skeleton component. Suspense fallbacks: `fallback={null}`.

---

## Content and voice

### Case conventions

- Section labels (brand): ALL CAPS with letter-spacing ("FOR ARTISTS", "ICECAST STREAM KEY")
- Page headings, panel titles: sentence case ("Your channel", "Go Live")
- Button labels: sentence case ("Copy", "Rotate RTMP key", "Pay €30 / year")
- Badge labels: ALL CAPS (LIVE, FLAC, MP3)

### Brand vocabulary

Do not rephrase these terms in UI copy:

| Term | Usage |
|------|-------|
| **Engagement units** | Grant-pool currency (free DL = 1×, paid DL = 5×, fan-sub euro = 1×) |
| **Fan subscriptions** | Direct artist-to-fan recurring payments — never "Tahti Premium" |
| **Fan tiers** | Configurable subscription levels per artist |
| **Grants** | Annual surplus redistribution to artists |
| **Membership** | Tahti ry cooperative membership (annual fee) — distinct from fan subscriptions |
| **Archive** | Collection of past broadcasts — not "recordings" or "sets" |
| **Broadcasting** | The act of going live — capitalized in status indicators |
| **Channel** | The artist's always-on URL — not "profile" or "station" |
| **Smart link** | Release landing page at `/r/[slug]` |
| **Download gate** | Repost/follow-to-download feature |

### Number formatting

- Currency: euro symbol before amount, no space (`€15`, `€30/year`) — Finnish convention
- Accounting precision: `.toFixed(2)` for exact amounts, `.toFixed(0)` for round prices
- Locale for accounting: `fi-FI` (`€1.247,00` — period as thousands separator, comma as decimal)
- Duration: `2h 08m`, seconds-only when `< 60s`
- Percentages: no decimal (`${pct}%`)

### Date and time

No hardcoded 24-hour clock. Schedule pages use `toLocaleString({ dateStyle: 'medium', timeStyle: 'short' })`. UTC is surfaced where it matters ("resets Monday 00:00 UTC").

### Iconography

No React icon library is installed (`packages/ui` has no icon dependency). The marketing site and mockups use emoji as icons. Admin dashboard panels use no icons. The brand nav logo mark is a CSS `div` — 3px × 20px, amber.

---

## Accessibility commitments

Target level: WCAG 2.1 AA.

### Contrast ratios (dark/brand surface accents vs `--bg: #0a0f1e`)

| Color | Hex | Ratio | AA | AAA |
|-------|-----|-------|----|-----|
| Primary text (`--text`) | `#e8eaf6` | 16.9:1 | ✓ | ✓ |
| Amber (`--amber`) | `#f0a500` | 9.2:1 | ✓ | ✓ |
| Cyan (`--cyan`) | `#00bcd4` | 8.2:1 | ✓ | ✓ |
| Green (`--green`) | `#00e676` | 11.1:1 | ✓ | ✓ |
| Coral (`--coral`) | `#ff6b6b` | 7.0:1 | ✓ | borderline |
| Lavender (`--lavender`) | `#9c88ff` | 6.9:1 | ✓ | ✗ |
| Muted text (`--muted`) | `#8892a4` | 6.4:1 | ✓ | ✗ |
| **Purple (`--purple`)** | `#7c4dff` | **4.1:1** | **✗ small text** | ✗ |

**Purple warning:** `--purple` (#7c4dff) fails WCAG AA for text smaller than 18px (or 14px bold). It is used in the codebase for fan-subscription heading color, progress bar fills, and chart bars — all near or at the threshold. Do not use purple for body-sized text. Use `--lavender` (#9c88ff) as a purple-family substitute for small text.

### Semantic patterns in code

- `<Alert>` → `role="alert"` (immediate screen-reader announcement)
- HLS player loading → `role="status" aria-live="polite"`
- Next-broadcast countdown → `role="status"` on container
- Bar charts → `role="img" aria-label="…"` on the chart container

### Keyboard and focus

Admin surface: all form controls receive `--tahti-focus-ring` on `:focus` (2px surface + 4px blue ring). Brand surface: **gap — no `:focus-visible` ring is declared** on `.btn-primary`, `.btn-secondary`, etc.

### Reduced-motion

Channel text-layer animations respect `prefers-reduced-motion: reduce`:

```css
@media (prefers-reduced-motion: reduce) {
  .text-layer--gradient-shimmer .text-layer__heading,
  .text-layer--shimmer-lines .text-layer__heading,
  .text-layer--ghost-echo .text-layer__heading { animation: none; }
}
```

**Gap:** The broadcasting pulse animation (`@keyframes pulse` on `.badge-live-dot`) has no `prefers-reduced-motion` guard. The dot should remain visible but static when the user has requested reduced motion.

---

## Mobile-specific patterns

The admin dashboard has no responsive breakpoints — designed for desktop use.

The brand/dark surface has one breakpoint at 768px:

```css
@media (max-width: 768px) {
  .nav     { padding: 14px 20px; }
  .section { padding: 80px 20px 60px; }
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}
```

At mobile: all column grids collapse to single-column. Stat cards stack vertically.

---

## Known gaps

| Gap | Status |
|-----|--------|
| Toast / notification system | Not built — only `<Alert>` (inline) exists |
| Modal / dialog | Not built — destructive actions are one-click |
| Skeleton loading | Not built — Suspense fallbacks use `null` |
| Dark admin dashboard | Intended (see mockups) but not yet implemented |
| Focus ring on brand surface buttons | Not declared — accessibility gap |
| Reduced-motion on pulse animation | Not guarded — accessibility gap |
| Purple at small text | `--purple` fails AA at < 18px |
| Sidebar React component | CSS classes exist; no React wrapper |

---

## Application notes

### What to swap when applying to a different brand

1. **`--amber` (#f0a500)** → your primary brand color. This is the most pervasive single swap — it touches CTA buttons, wordmark, stat highlights, section subtitle accents, callout labels.
2. **`--bg` / `--card` / `--card2`** (#0a0f1e / #111827 / #1a2340) → adjust depth levels if the new brand reads differently at this darkness.
3. **Logo / wordmark** — Tahti's wordmark is `TAHTI` in uppercase Space Grotesk + 3px amber vertical bar. Replace with the new brand name and bar color.
4. **Font families** — if the new brand has licensed type, replace `'Space Grotesk'` for display. Inter can usually stay for body.
5. **Favicon and OG image.**

### What to keep regardless of brand

- `--green` (#00e676) as the live/broadcasting state color. It is not a brand color — it is a safety-convention color.
- `--coral` (#ff6b6b) for destructive/error states.
- The three-level background hierarchy (`--bg` → `--card` → `--card2`).
- The 4px spacing base and 16px grid gap for card grids.
- Sentence case for headings and button labels; ALL CAPS only for badge labels and section metadata labels.

### What to evaluate per project

- **Stat cards with accent colors:** Appropriate when working professionals need at-a-glance readouts. Not appropriate for a contemplative consumer product.
- **Grouped sidebar navigation:** Works because artists think in domain groups (channel / releases / community / money). Evaluate whether the new product's domain has equivalent groupings.
- **Broadcasting-style status bar:** Applicable when a live/active state needs to be immediately visible across sessions. Skip for CRUD tools with no real-time state.
- **Dark-by-default:** Justified by long broadcast sessions. Evaluate whether the new product has similar fatigue considerations.

### Five-step adoption process

1. **Copy the token file.** Paste `packages/ui/src/tokens.css` into your project. Change `--amber` to your brand color. Verify in the browser.
2. **Install fonts.** Add Space Grotesk and Inter via `next/font/google` or equivalent. The display personality of Space Grotesk is load-bearing — the system looks wrong with a generic sans-serif substitute.
3. **Set up CSS variables.** Import the token file at root scope. Verify that `body { background: var(--bg); color: var(--text); }` renders the expected dark surface.
4. **Build the shell first.** Implement the page container, sidebar (if applicable), and stat-card grid before domain-specific content. Getting the shell right makes every panel feel consistent.
5. **Verify contrast on your brand color.** Run your `--amber` replacement through a WCAG contrast checker against `--bg`. It must pass AA (4.5:1) for body text. Darken or lighten if needed — do not skip this.

### Anti-patterns to avoid

- **Making the brand color the broadcasting-status color.** If your brand color is green, you still need a distinct green for live state — use a different shade, or reconsider the live-state convention entirely.
- **Using stat-card colors decoratively.** Cyan as a section accent on a non-technical page, purple as a decorative card background — these erode the semantic model. If you use the color palette, commit to the semantics.
- **Softening the dark background.** Changing `--bg` to `#1a1a2e` or a generic dark gray reads as unfinished. The deep navy (#0a0f1e) is specifically chosen for its warmth and cinema-like quality.
- **Purple at small text sizes.** `--purple` (#7c4dff) fails WCAG AA for text under 18px. Use `--lavender` (#9c88ff) for small purple-range text.
- **Using amber for success states.** Amber is already used for primary CTA, pricing, and key metrics. Extending it to success creates semantic collision with "important thing requiring attention."
