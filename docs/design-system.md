# Tahti — design system

Extracted from the presentation slides and marketing site. Every application surface — channel pages, dashboard, profile, smart links, transparency ledger — must follow these principles. The agent that builds the product must read this document before writing any UI code.

---

## Principles

1. **Dark, deep, not black.** Background is `#0a0f1e` — a deep navy, not pure black. Cards lift from the background with `#111827` and `#1a2340`. Never use `#000`.
2. **Amber is the heartbeat.** The primary accent is amber/gold `#f0a500`. It marks CTAs, the logo bar, key values, and live-state highlights. Every page should have amber somewhere above the fold.
3. **Each feature has a color.** Cyan = tech/streaming. Green = live/positive. Purple = community/membership. Coral = problems/warnings. Lavender = governance/member features. Colors are not decorative — they carry meaning.
4. **Headings are bold and left-aligned.** No centered h1s except on the smart-link landing page. Large, Space Grotesk, tight line-height.
5. **Italic subtitles are colored.** Every major heading is followed by an italic line in a feature color. This is a visual signature of the brand.
6. **Cards have a left accent stripe.** Never a top or right border as primary accent. The 3px left border tells you the card's category.
7. **Labels are uppercase + letter-spaced.** Section labels, category tags, stat labels: 10–11px, letter-spacing 2–4px, muted color or feature color.
8. **Space is generous.** Cards pad 24px. Sections pad 80–100px vertically. Don't compress.
9. **Motion is subtle.** Hover: `translateY(-3px)` on cards, `scale(1.05)` on nav CTA. Reveals: `opacity 0→1, translateY(40px→0)`. No bounces, no spins.
10. **No algorithmic aesthetics.** No engagement metrics displayed to listeners. No "trending" indicators. No likes. No algorithmic colors (TikTok red, YouTube red, Spotify green). Those are theirs.

---

## Color tokens

```css
:root {
  /* Backgrounds */
  --bg:     #0a0f1e;   /* page background — deep navy */
  --card:   #111827;   /* card surface */
  --card2:  #1a2340;   /* elevated card, callout bg, stat bg */

  /* Accents — each carries semantic meaning */
  --amber:    #f0a500;  /* primary CTA, logo, key values, live highlights */
  --cyan:     #00bcd4;  /* streaming, tech, player controls */
  --green:    #00e676;  /* live state, positive status, open formats */
  --purple:   #7c4dff;  /* community, fan-subscriptions, governance */
  --coral:    #ff6b6b;  /* problems, errors, competitor critique */
  --lavender: #9c88ff;  /* membership, artist designation, grants */

  /* Text */
  --text:   #e8eaf6;   /* primary text */
  --muted:  #8892a4;   /* secondary text, labels, captions */

  /* Typography */
  --font-head: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Borders */
  --border:       rgba(255, 255, 255, 0.07);
  --border-hover: rgba(255, 255, 255, 0.15);
}
```

### Color semantics

| Color | Use for |
|-------|---------|
| `--amber` | Primary CTA buttons, logo bar, live-set highlights, key financial figures, feature accent when no other applies |
| `--cyan` | Player controls, stream quality badges, tech features, dashboard active state, "tune in" CTA |
| `--green` | LIVE badge and dot, positive status, archive open formats, grant-positive states |
| `--purple` | Fan-subscriptions, membership features, community governance, Tahti Radio |
| `--coral` | Error states, competitor problems, warnings, the "why you're leaving SoundCloud" moment |
| `--lavender` | Artist designation in chat, artist handles, governance text, member portal |
| `--muted` | Secondary body copy, labels, timestamps, captions, placeholder text |

---

## Typography

### Fonts

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap" rel="stylesheet">
```

### Scale

| Role | Font | Size | Weight | Notes |
|------|------|------|--------|-------|
| Page hero h1 | Space Grotesk | `clamp(48px, 7vw, 90px)` | 700 | Line-height 1.05 |
| Section h2 | Space Grotesk | `clamp(32px, 5vw, 58px)` | 700 | Line-height 1.1 |
| Italic subtitle | Inter italic | `clamp(18px, 2.5vw, 28px)` | 300 | Color = feature accent |
| Card heading | Space Grotesk | 16px | 600 | |
| Body lead | Inter | 16–17px | 400 | Color: `--muted`, line-height 1.7 |
| Body | Inter | 14px | 400 | Color: `--muted`, line-height 1.6 |
| Label/tag | Space Grotesk or Inter | 10–11px | 600 | Uppercase, letter-spacing 2–4px |
| Stat value | Space Grotesk | 24–56px | 700 | Color: feature accent |
| Monospace | system monospace | 13–22px | 400 | For URLs, stream keys, code |

### Text patterns

**Hero pattern:**
```
[LABEL — 11px uppercase letter-spaced muted]
H1 in Space Grotesk, large, white
Italic subtitle in Inter italic, amber/cyan/etc.
Body copy in Inter, muted, 17px, line-height 1.7
```

**Section pattern:**
```
H2 in Space Grotesk
Italic subtitle line in feature color
Optional lead paragraph in muted
Cards grid
Optional callout box
```

**Label before heading:**
```css
.label::before {
  content: '';
  display: inline-block;
  width: 30px; height: 1px;
  background: var(--amber);
  margin-right: 12px;
}
```

---

## Spacing

| Token | Value | Use |
|-------|-------|-----|
| Section vertical padding | 80–100px | Top/bottom of each section |
| Card padding | 24px | Standard card inner padding |
| Pricing card padding | 36px | Larger featured cards |
| Card gap | 16px | Gap between cards in a grid |
| Section inner max-width | 1100px | Content column |

---

## Border radius

| Context | Radius |
|---------|--------|
| Standard cards | 8px |
| Pricing cards, modals | 12px |
| Buttons | 6–8px |
| Badges, pills | 20px |
| Avatars | 50% |
| Inputs | 6–7px |
| Player cover art | 8–10px |

---

## Components

### Card

The foundational element. Dark background, 3px left border in a feature color, hover lift.

```css
.card {
  background: var(--card);          /* #111827 */
  border-radius: 8px;
  padding: 24px;
  border-left: 3px solid var(--amber); /* swap color per feature */
  transition: transform 0.3s, border-color 0.3s;
}
.card:hover { transform: translateY(-3px); }
```

**Color variants:** `.amber` `.cyan` `.green` `.purple` `.coral` `.lavender`

**With top accent line (slide style):**
Used on slides for 4-column feature grids. The top line is 3px solid feature color, then card bg starts.

**Horizontal tool card:**
Icon (32px) on the left, title + subtitle on the right, full border on left side. Used for broadcasting tools.

### Callout box

Used at the bottom of sections to summarize or contrast. Darker background, 1px colored border, label + body.

```css
.callout {
  background: var(--card2);               /* #1a2340 */
  border: 1px solid rgba(240, 165, 0, 0.3); /* amber at 30% */
  border-radius: 8px;
  padding: 20px 28px;
}
.callout-label {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--amber);
  margin-bottom: 8px;
  text-transform: uppercase;
}
```

### URL box

Monospace display of a canonical URL. Used to emphasize "one URL" messaging.

```css
.url-box {
  background: var(--card2);
  border: 1px solid rgba(0, 188, 212, 0.4); /* cyan */
  border-radius: 8px;
  padding: 22px;
  text-align: center;
  font-family: monospace;
  font-size: 22px;
  color: var(--muted);
}
.url-box span { color: var(--amber); font-weight: 700; }
```

### Buttons

**Primary (amber):**
```css
.btn-primary {
  background: var(--amber);
  color: #0a0f1e;
  padding: 14px 30px;
  border-radius: 8px;
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  transition: opacity 0.2s, transform 0.2s;
}
.btn-primary:hover {
  opacity: 0.88;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(240, 165, 0, 0.35);
}
```

**Secondary (ghost):**
```css
.btn-secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 13px 28px;
  border-radius: 8px;
}
.btn-secondary:hover {
  border-color: var(--amber);
  color: var(--amber);
  transform: translateY(-2px);
}
```

**Small utility button:**
```css
.btn-sm {
  background: var(--card2);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text);
}
```

### Badges

**LIVE badge (green):**
```css
.badge-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--green);
  letter-spacing: 1px;
}
.badge-live::before {
  content: '';
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--green);
  animation: pulse 1.5s ease-in-out infinite;
}
```

**Quality badge (cyan for FLAC, muted for MP3):**
```css
.badge-quality {
  font-size: 10px;
  letter-spacing: 1px;
  background: rgba(0, 188, 212, 0.15);
  color: var(--cyan);
  padding: 3px 8px;
  border-radius: 4px;
}
.badge-quality.mp3 {
  background: rgba(136, 146, 164, 0.15);
  color: var(--muted);
}
```

**Pill badge (recommended, member, etc.):**
```css
.badge-pill {
  background: var(--cyan);
  color: #0a0f1e;
  font-size: 11px;
  letter-spacing: 2px;
  font-weight: 700;
  padding: 4px 14px;
  border-radius: 20px;
}
```

### Inputs

```css
.input {
  width: 100%;
  background: var(--card2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 7px;
  padding: 12px 14px;
  font-size: 14px;
  color: var(--text);
  font-family: var(--font-body);
  outline: none;
  transition: border-color 0.2s;
}
.input:focus { border-color: rgba(240, 165, 0, 0.5); }
.input::placeholder { color: rgba(255, 255, 255, 0.18); }
```

**Form label:**
```css
.label {
  display: block;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--muted);
  margin-bottom: 7px;
  font-weight: 600;
  text-transform: uppercase;
}
```

### Navigation

```css
nav {
  position: fixed; top: 0; left: 0; right: 0;
  background: rgba(10, 15, 30, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 18px 40px;
  z-index: 100;
}
.nav-logo {
  font-family: var(--font-head);
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.nav-logo-bar {
  width: 3px; height: 20px;
  background: var(--amber);
}
```

### Stat block

```css
.stat {
  background: var(--card2);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-value {
  font-family: var(--font-head);
  font-size: 26px;
  font-weight: 700;
  color: var(--amber); /* swap to feature color */
}
.stat-label {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
  letter-spacing: 0.5px;
}
```

### Sidebar navigation (dashboard)

```css
.sidebar-item {
  padding: 10px 20px;
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
}
.sidebar-item.active {
  background: rgba(0, 188, 212, 0.08);
  color: var(--cyan);
  border-right: 2px solid var(--cyan);
}
```

### Pinned announcement (chat)

```css
.pinned {
  background: rgba(240, 165, 0, 0.1);
  border: 1px solid rgba(240, 165, 0, 0.3);
  border-radius: 6px;
  padding: 10px 12px;
}
.pinned-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--amber);
  margin-bottom: 4px;
  text-transform: uppercase;
}
```

### Waveform animation

```css
.waveform { display: flex; align-items: center; gap: 2px; }
.wf-bar {
  background: var(--cyan);
  border-radius: 2px;
  width: 3px;
  animation: wfpulse 1s ease-in-out infinite;
}
@keyframes wfpulse {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
}
/* Stagger bars with animation-delay: 0s, 0.1s, 0.2s, etc. */
```

### Progress / fill bars

```css
.progress-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
.progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--cyan); /* or feature color */
}
```

---

## Layout patterns

### 3-column feature grid
Most common pattern: `grid-template-columns: repeat(3, 1fr); gap: 16px`. Used for tools, features, platform comparisons.

### 2-column split
`grid-template-columns: 1fr 1fr; gap: 24px`. Used for hero (text + video), pricing, distribution types.

### 4-column stat row
`grid-template-columns: repeat(4, 1fr); gap: 12px`. Dashboard stats only.

### Dashboard layout
`grid-template-columns: 200px 1fr`. Sidebar (darker, `#0d1626`) + main content area.

### Channel page layout
`grid-template-columns: 1fr 320px`. Player main + chat sidebar. On mobile, sidebar hides.

---

## Scroll reveal animation

```css
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
```

Triggered via IntersectionObserver when the element enters the viewport.

---

## Pages and their primary accent

| Page | Primary accent | Reason |
|------|---------------|--------|
| Marketing / hero | amber | CTA, logo, value props |
| Channel (live state) | green | Live indicator |
| Channel (offline) | amber | Archive fallback |
| Artist dashboard | cyan | Active nav, controls |
| Analytics | cyan + green | Charts + grant box |
| Artist profile | cyan | "Tune in" CTA |
| Smart link | amber | Release spotlight |
| Fan-subscription | purple | Community feature |
| Transparency ledger | green | Positive financial state |
| Membership / governance | lavender | Member features |
| Error / warning | coral | Problem states |

---

## Do's and don'ts

**Do:**
- Use Space Grotesk for all headings, stats, and the logo
- Follow every heading with an italic subtitle in a feature color
- Keep cards with left border stripes (3px, feature color)
- Use uppercase letter-spacing for all category labels
- Make amber the primary CTA on every page
- Use `--card2` for callout boxes and elevated stats
- Give live state green dot + pulse animation
- Display FLAC badge in cyan, MP3 badge in muted

**Don't:**
- Center hero text (smart link page is the only exception)
- Use more than 2–3 accent colors on a single page
- Show listener-hour counts as grant metrics anywhere
- Add follower counts, likes, or engagement metrics to listener-facing surfaces
- Use pure black (`#000`) anywhere — use `--bg` instead
- Put advertising, sponsor logos, or algorithmic suggestions in the UI
- Make the free tier look broken or limited — it's a complete product
- Animate anything that's not a hover, reveal, live indicator, or waveform

---

## Responsive breakpoints

```css
/* Single breakpoint — design collapses at 768px */
@media (max-width: 768px) {
  nav { padding: 14px 20px; }
  section { padding: 80px 20px 60px; }
  .cards-3, .cards-4 { grid-template-columns: 1fr; }
  .cards-2 { grid-template-columns: 1fr; }
  .ch-sidebar { display: none; } /* chat sidebar hides on mobile */
  .db-sidebar { display: none; } /* dashboard sidebar hides on mobile */
  .db-stats { grid-template-columns: repeat(2, 1fr); }
}
```

Mobile channel view uses a phone-shaped layout with cover art fullwidth, controls below, chat as a collapsible bottom sheet.

---

## `packages/ui` adoption (PLAT-020)

The shared React package lives in `packages/ui/` (dark-brand components: `Button`, `Card`, `Callout`, `Stat`, …). The Next.js app currently uses **`apps/web/src/components/ui/`** with a **light dashboard shell** (`--tahti-*` tokens) and brand tokens for public surfaces.

**Phase 1 (done):** worker cron manifest; unified `scripts/backup.sh`.

**Phase 2 (in progress):**

1. Add `@tahti/ui` as a workspace dependency in `apps/web` (`transpilePackages`).
2. Use package components on **dark public routes** first (`/c/:slug`, `/u/:username`, `/r/:slug`) where tokens match `docs/design-system.md`.
3. Keep dashboard on light `--tahti-*` tokens until a deliberate dashboard dark-theme pass.

**Phase 3:** Collapse duplicate primitives — re-export or replace `apps/web/src/components/ui/button.tsx` where APIs align.

Do not import `packages/ui` CSS into the light dashboard without scoping — token names (`--bg`, `--text`) differ from `--tahti-bg` / `--tahti-text`.
