# Tahti — design conformance instructions (v3)

## Why previous attempts failed, and what changes now

Previous attempts gave you (the agent) mockup *screenshots* and asked you to match them. That failed because **you cannot measure pixels in an image**. You guessed dimensions, and you guessed with flexible units — `flex-grow`, `w-full`, percentages — which stretch. The result at app.tahti.live is structurally right but visually wrong: stretched layouts, inconsistent spacing, things out of place.

From now on, **screenshots are not your reference. The `reference/` folder is.** It contains pixel-exact HTML/CSS implementations of the target design. You don't interpret anything — you open the reference file, inspect it, and copy the exact values. The screenshots remain useful only as a final "does it feel right" check.

```
reference/
  tokens.css          ← every color, size, spacing, radius. THE source of truth.
  components.html     ← every primitive with annotated dimensions
  dashboard.html      ← exact target for /dashboard
  channel-live.html   ← exact target for channel page (live state)
  release.html        ← exact target for /r/<slug>
```

Open these in a real browser. Use devtools. When you need to know "how wide is the sidebar" — don't guess, don't eyeball a screenshot: read `--sidebar-w: 220px` from tokens.css.

---

## The three rules that fix the stretching

The stretching/misplacement problem has three root causes. Each gets a hard rule:

### Rule 1: Every page lives inside a named shell with FIXED dimensions

There are exactly four page shells. Every route uses one. No page does its own layout.

| Shell | Grid | Used by |
|---|---|---|
| `shell-app` | `220px 1fr`, content `max-width: 1080px`, padding 24px | All `/dashboard/*`, `/app/*`, `/admin/*` |
| `shell-channel` | `1fr 300px`, gap 16px, `max-width: 1140px` centered | Channel pages (live + 24/7) |
| `shell-public` | single column, `max-width: 1140px` centered, padding 24px | Homepage, profile, venues, about |
| `shell-narrow` | single column, `max-width: 460px` centered | Release smart link, subscribe |

The sidebar is **exactly 220px**. The chat rail is **exactly 300px**. They never flex, never grow, never shrink above the mobile breakpoint. Content columns have a **max-width** — they never span the full viewport on wide screens. This single rule kills most of the stretching.

```css
/* FORBIDDEN in any page or component: */
.sidebar { flex: 1 }          /* sidebars don't flex */
.content { width: 100% }      /* without max-width, this stretches */
.cover   { width: 50% }       /* cover art never has percentage width */

/* REQUIRED instead: */
.shell-app  { display: grid; grid-template-columns: 220px 1fr; }
.shell-app__content { max-width: 1080px; padding: 24px; }
```

### Rule 2: Fixed-size elements have fixed sizes

These elements have exact pixel dimensions in tokens.css. Use them. Never derive their size from container width:

| Element | Size |
|---|---|
| Cover art | 24 / 46 / 80 / 140 px (or `width:100%; aspect-ratio:1` ONLY inside a fixed-column grid) |
| Buttons | height 44px, standard/big size for every button (small 36px is an opt-in exception for dense inline contexts — see `ground-rules.md` Rule 4) |
| Inputs | height 36px |
| Sidebar items | height 34px |
| Top nav | height 56px |
| Stat number | font-size 28px (compact: 22px) |
| Avatars | same scale as cover art |

If an element in your implementation is a different size than in `components.html`, your implementation is wrong — not the reference.

### Rule 3: Only token values exist

Every color, spacing, radius, and font-size in production code maps 1:1 to a value in `reference/tokens.css`. Mechanical enforcement:

```bash
# This grep must return ONLY tokens.css (or tailwind.config which imports it):
grep -rn '#[0-9a-fA-F]\{3,8\}' --include="*.tsx" --include="*.ts" --include="*.css" \
  app/ components/ src/ 2>/dev/null | grep -v node_modules | grep -v tokens
```

Gap values come from the spacing scale (4/8/12/16/20/24/32/40). If you write `gap: 13px` or `padding: 18px`, you've invented a value — stop and use the nearest scale step.

---

## The conformance workflow (per page)

For every page you build or fix, this exact loop. No steps skipped:

### Step 1: Open the reference

```bash
# Serve the reference folder so CSS loads:
cd reference && python3 -m http.server 8888
# Open http://localhost:8888/dashboard.html in a browser at 1280px width
```

If the page you're building has no reference HTML file (e.g. stats, newsletter, settings, 24/7 channel, subscribe), **compose it from components.html patterns + the shell rule + the mockup screenshot as layout guide**. The screenshots are fine for understanding *what goes where* — they're only unreliable for *exact values*, which now come from tokens.css and components.html.

### Step 2: Implement using only shells + primitives + tokens

The page file should be nearly styling-free. If your page contains layout CSS beyond picking a shell and stacking components, you're doing it wrong.

### Step 3: Screenshot both at identical width

```bash
# Your implementation:
npx playwright screenshot --viewport-size=1280,900 http://localhost:3000/dashboard out/impl-dashboard.png
# The reference:
npx playwright screenshot --viewport-size=1280,900 http://localhost:8888/dashboard.html out/ref-dashboard.png
```

### Step 4: Compare. Look at exactly these five things, in order

1. **Column widths.** Is the sidebar 220px? Is content capped at its max-width? Is the chat 300px? (This is where stretching shows up first.)
2. **Background layering.** Page bg darkest → card → elevated card. Three distinct steps visible?
3. **Stat colors.** Plays amber, downloads green, fans purple, revenue cyan — exactly?
4. **Type sizes & weights.** Stat numbers 28px/500? Labels 10px uppercase tracked? Nothing bolder than 500?
5. **Spacing rhythm.** 12px gaps in grids, 16px between sections, 24px page padding?

If any of the five differ visibly: fix, re-screenshot, re-compare. **The page is not done until you cannot tell which screenshot is the reference.** "Compiles and roughly resembles" is not done.

### Step 5: Mobile pass

Re-screenshot at 375px. The shells respond as follows — implement exactly this, nothing fancier:

- `shell-app`: sidebar collapses to a hamburger/drawer; content full-width with 16px padding
- `shell-channel`: chat moves below content (single column); everything stacks
- `shell-public` / `shell-narrow`: already single column; padding drops to 16px
- Stat grids: `repeat(4,1fr)` → `repeat(2,1fr)` at <768px
- Cover grids: 4 columns → 2 columns

---

## Repairing the existing app (do this before building anything new)

The live app at app.tahti.live has accumulated drift. Repair in this order:

### Pass 1: Mechanical sweep (highest value, lowest risk)

1. **Replace every raw hex/px** with token references. Run the grep above; drive it to zero.
2. **Fix the leaked dev artifacts.** The production footer links to `http://localhost:3000/status`. Find all `localhost` references and replace with relative paths or env-based URLs.
3. **Wrap every page in its shell.** Audit each route; if it isn't using one of the four shells, wrap it. This alone fixes most stretching.

### Pass 2: Component consolidation

Find duplicate implementations (multiple stat cards, multiple buttons, inline one-offs). Consolidate to one component each, matching components.html. Replace all usages.

### Pass 3: Page-by-page conformance

Run the conformance workflow on every existing page, in this order (most-visited first): homepage → channel page → dashboard → stats → release page → everything else.

### Empty-state rule (the "0 active artists" problem)

The homepage currently shows "0 active artists · 0 broadcasts this month · 0 h broadcast in total". **Never render zero-stats on a marketing surface.** Rule:

- If a stat is 0 or the platform is pre-launch, hide the stats strip entirely, or replace it with qualitative copy ("Founding cohort now onboarding").
- Empty lists ("On air right now" with no live channels) get a designed empty state: muted card, one line of copy, one action. Never a lone demo item, never a blank section.
- This applies to every list in the app: archive with no items, chat with no messages, releases with none yet. Every list component needs an `empty` slot before it ships.

---

## Definition of done (per page)

- [ ] Uses one of the four named shells — no bespoke page layout
- [ ] Sidebar/chat/nav at exact fixed dimensions; content max-width respected
- [ ] Zero raw hex/px values — grep is clean
- [ ] Stat colors match meaning (amber/green/purple/cyan)
- [ ] No font-weight above 500 anywhere
- [ ] Screenshot at 1280px is indistinguishable from reference (or from components-composed target where no reference file exists)
- [ ] Screenshot at 375px shows correct stacking
- [ ] Empty states designed, not blank
- [ ] No localhost/dev URLs in output

## Definition of done (whole app)

- [ ] All five per-page checks pass on every route
- [ ] One Button, one StatCard, one Card, one Pill — no duplicates anywhere
- [ ] `reference/tokens.css` values match production tokens exactly (diff them)
- [ ] Side-by-side screenshot folder committed: `screenshots/impl-*.png` + `screenshots/ref-*.png` so Long can review conformance without running anything

## When to stop and ask Long

- A view has no reference file AND the mockup screenshot is ambiguous about structure
- You'd need a token that doesn't exist (new color, new size) — adding tokens is a design decision
- Existing functionality would break by enforcing a shell (e.g., a page genuinely needs full width)
- Anything touching payments, audio pipeline, or grant math

Everything else — decide and proceed. Layout questions are answered by the shells. Value questions are answered by tokens.css. Structure questions are answered by the reference HTML.
