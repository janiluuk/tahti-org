# Tahti — design system ground rules (addendum)

This document extends `tahti-design-system-enforcement.md` with four hard rules that govern *what* views look like at the structural level. Where the previous brief enforces *consistency* (tokens, shells, primitives), this one enforces *density, character, and control affordance* (no-scroll, no-form-aesthetic, no-anemic-buttons).

These rules are non-negotiable. They are added to the conformance gate, not advisory.

## The four rules

1. **No scrolling unless it's the last option.** Every dashboard task view fits on a 1440×900 viewport at 100% zoom. The artist completes the task without scrolling.
2. **All views manageable from one screen.** Everything needed to perform the view's job is visible simultaneously. No tabbing between sections to find a control. No collapsed accordions hiding the primary affordance.
3. **Never a tax filing form.** No view consists primarily of stacked label+input pairs. Every view has a hero element that conveys state or affords direct manipulation.
4. **Every button is a standard, big, icon button.** One button component, one size (big), everywhere. No bespoke `<button>` markup, no accidental unpadded/unstyled buttons, no tiny click targets.

The constitution already implies these (rule 2: "highest quality, community-driven"; rule 3: "the artist shines brightest, no rip-offs"). This document makes them operational.

## Rule 1 — no scrolling

### What it means concretely

At viewport 1440×900 (the design baseline) and 100% browser zoom, `document.body.scrollHeight` must be ≤ 900 for every dashboard task route. Period.

This is uncomfortable. Most "good enough" SaaS dashboards quietly accept that you scroll. We're not making one of those. The constraint forces density, hierarchy, and prioritization. If something doesn't fit, something else doesn't deserve to be on the page.

### Why this matters

An artist mid-broadcast does not have time to scroll for the end-broadcast button. A musician finishing a mix does not have time to scroll for the export action. The "primary action visible without scrolling" rule is not a UX preference — it's how you treat someone using a tool under time pressure.

A dashboard you scroll through is a dashboard you read; a dashboard you don't scroll through is a dashboard you operate.

### Mechanical enforcement

Add to `packages/ui-test/no-scroll.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const NO_SCROLL_ROUTES = [
  '/dashboard',
  '/dashboard/broadcast?step=1',
  '/dashboard/broadcast?step=2',
  '/dashboard/broadcast?step=3',
  '/dashboard/broadcast?step=4',
  '/dashboard/channel/edit',
  '/dashboard/stats',
  '/dashboard/revenue',
  '/dashboard/archive',
  '/dashboard/upload',
  '/dashboard/collections',
  '/dashboard/newsletter/compose',
  '/dashboard/settings/account',
  '/dashboard/settings/payments',
  '/dashboard/settings/fan-subs',
  '/dashboard/settings/multistream',
  '/dashboard/settings/notifications',
  '/admin',
  '/admin/grants/2026',
  '/signup',
  '/transparency',     // header section fits; ledger paginates below — header alone must fit
  '/governance',
];

for (const route of NO_SCROLL_ROUTES) {
  test(`${route} fits in 1440×900 viewport without scrolling`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
    expect(scrollHeight, `${route}: scrollHeight ${scrollHeight} > clientHeight ${clientHeight}`).toBeLessThanOrEqual(clientHeight);
  });
}
```

This blocks PRs that introduce a scrolling dashboard route. The first run will fail most existing routes. Good — that failure list is the redesign work queue.

### Allowed exceptions (be explicit, no silent additions)

| Route | Why exempt |
|---|---|
| `/dashboard/archive/:id/editor` | The audio editor is a full-bleed instrument. Its content is dense and all controls remain visible at once — it doesn't scroll either, it just renders tall on a tall viewport. Confirmed via the per-route layout test from the previous brief. |
| `/u/:handle/c/:slug` (collection pages) | Public collection pages with many tracks. Tracks scroll, but the hero + cover + first track must fit above the fold at 1440×900. |
| `/transparency/grants/:year`, `/admin/grants/:year` | Per-artist allocation tables have N rows; paginated to 50 per page. The KPI strip + filters must fit above the fold; the table itself paginates. |
| `/dashboard/archive` (history view) | Paginated, like grants. Header + first ~6 rows fit; older entries paginate. |
| `/u/:handle` channel page | Listener-facing; standard web-page scroll is acceptable here, but the player + chat must be above the fold. |
| `/` homepage | Marketing-like; scroll allowed but discouraged. |
| `/dashboard/stats/detail` | New route (not in the 16 reference HTMLs) created to hold the plays-over-time chart and the listener choropleth map that had been bolted onto `/dashboard/stats` itself, violating Rule B against the 09-stats-reframe.html reference. The map is an SVG world projection scaled to container width; shrinking it enough to clear the remaining ~185px would make country shapes illegible at 1440×900. Header + chart fit above the fold; the map renders tall below it. |
| `/admin/governance/audit` | Same pattern as `/admin/grants`: 50 rows/page with Previous/Next pagination, not an unbounded list. Header + filter form bottoms out at 231px, comfortably above the fold; the table itself is the part that's tall, by design. |
| `/admin/users` | Paginated user directory (`page` query param, search/filter form). Filter bar fits at 192px, well above the fold; the table is the part that scrolls, and it's expected to grow with the org's membership. |
| `/transparency` | Public report page, not a task surface — same category as `/` and the channel page. Header + KPI strip + ledger preview bottom out at 598px, well above the fold; the YTD breakdown, monthly detail, board resolutions, and storage stats below are normal scrolling report content. |

That's it. Ten exceptions. Every other route fits.

### Mobile is a separate rule

At 375×812 viewport, scrolling is expected. The no-scroll rule applies to desktop only. Add a separate Playwright assertion for mobile that checks the *hero* (top 40% of the view's content) fits above the fold:

```ts
test(`${route} hero fits above fold on mobile (375x812)`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(route);
  const heroBottom = await page.locator('[data-hero]').first().evaluate(el => el.getBoundingClientRect().bottom);
  expect(heroBottom, `${route} hero must fit in initial viewport on mobile`).toBeLessThanOrEqual(812);
});
```

Pages annotate their hero with `data-hero` on the relevant element (the Go Live card, the headline number, the broadcast status bar, etc.). This makes the assertion explicit.

## Rule 2 — all views manageable from one screen

### What it means concretely

Everything an artist needs to perform a view's job is visible at the same time. Tabs that hide controls behind other tabs are forbidden when the controls relate to the same task. Accordion-style collapse of primary actions is forbidden. The view shows its full surface; the artist's eyes pick.

### Why this differs from "no scrolling"

Two views can both fit in 1440×900 and still differ on this rule. A view that splits its controls into 5 tabs technically fits — but at any moment only 1 of 5 surfaces is visible. That violates Rule 2 even if Rule 1 passes.

The example that already does this right: **the channel designer** (mockup 08). Live preview on the left, all controls on the right, scroll-free, no tabs. Identity, bio, visual, links — all visible. The artist sees the whole tool. They can change a color and watch the cover update without clicking through tab states.

The example that would violate it: a settings page with `Account | Email | Notifications | Privacy | Billing` tabs that all live on the same route. That's 5 task surfaces hidden behind tabs — break it into 5 distinct routes, each focused, each manageable in one screen.

### Permitted progressive disclosure

Three patterns are still allowed because they preserve "manageable in one screen":

1. **Dropdowns for selection** (Select, DropdownMenu) — the open state is transient and reveals options, not task surface.
2. **Modals for sub-tasks** (Drive picker, Spotify search) — they cover the parent view because the sub-task is *adjacent*, not a hidden part of the same task. The modal itself follows Rule 1.
3. **Tooltip/popover for hints** — informational, not task surface.

Three patterns are forbidden:

1. **Tabs that split a single task** (e.g., "General | Advanced" within the channel designer). If both contain task surface, they belong on the same screen.
2. **Accordions on primary content.** A settings page with `▶ Email preferences` (collapsed) hiding the actual controls is a tax form's favorite trick.
3. **"Show advanced" links** that reveal critical actions. If it's critical, it's not advanced.

### Enforcement

Mechanical detection is hard; this rule sits in code review. Add to the conformance checklist:

> **Rule 2 check**: Is any portion of this view's primary task surface hidden behind a tab, accordion, or "show more"? If yes, redesign or split into a separate route.

Reviewers reject PRs that introduce these patterns on primary surfaces.

## Rule 3 — never a tax filing form

### Definition by anti-pattern

A view that looks like a tax form has all of these:

- Vertical stack of `<Label> <Input>` pairs as the dominant visual content
- No hero element other than the page H1
- Uniform spacing and styling across all rows — no visual hierarchy
- "Save" button at the bottom only, requiring scroll to reach
- Inputs and labels in the same weight and color throughout
- Fields ordered by data-model schema, not by what the artist wants to accomplish
- Required asterisks (`*`) scattered through the form
- Validation error messages stacking under fields
- No imagery, no live preview, no visual feedback

If three or more of these are present, the view is a tax form. Redesign.

### The instrument pattern (what to do instead)

The opposite of a tax form is an instrument. Instruments have:

1. **A hero element occupying ≥30% of viewport height** that conveys state or affords direct manipulation. Examples from existing mockups:
   - Channel designer: live preview of public page
   - Audio editor: waveform
   - Stats: hero number (56px amber)
   - Dashboard: Go Live card OR Broadcasting Now card
   - Broadcasting Setup step 2: live signal meters
   - Revenue: this-month earnings number
2. **A primary action visually prominent at the top of the view**, not the bottom. The artist can complete the task with one obvious click; configuration is in service of that click.
3. **Direct manipulation over text entry where possible.** Sliders for numbers. Color swatches for colors. Drag-drop for ordering. Toggles for booleans. Text inputs are a last resort, not a default.
4. **Live preview of consequence.** When the artist changes something, they see the effect within ~100ms. The channel designer is the reference pattern; settings pages should adopt the same split.
5. **Spatial hierarchy.** Primary task surface dominates; configuration is sized smaller and grouped by what it affects.
6. **Personality.** Color, gradient, motion, cover-art. The artist's identity comes through.

### Settings pages — the hardest case

Settings pages are inherently configuration-heavy. They're the easiest to turn into tax forms. They're also the most important to redesign because they're the most-touched surface for paying members.

**Tax-form settings (forbidden):**

```
[Account Settings]
Email address       [____________]  *
Display name        [____________]  *
Username            [____________]
Language            [Select ▼]
Time zone           [Select ▼]
Profile visibility  [Select ▼]
[Save changes]
```

**Instrument settings (required pattern):**

For `/dashboard/settings/notifications`:

```
[Hero: "How do you want to hear from Tahti?" + small illustration]

[Big toggle card 1: "Money moves"]
  When fan-subs come in, when payouts complete
  [✓ Email me]  [✓ In-app]
  Preview: small email mockup showing "@aurora_fi subscribed (€5/mo)"

[Big toggle card 2: "Listener actions"]
  New chat messages, new comments, broadcast feedback
  [✓ Email digest, daily]  [○ Off]
  Preview: small email mockup

[Big toggle card 3: "Weekly recap"]
  Your Sunday stats summary
  [✓ Email me]
  Preview: small email mockup with stat numbers
```

Three task surfaces. Each one combines: a clear label, a toggle (direct manipulation), a preview of what the email will look like. The artist sees their choices and their consequences at the same time. No scrolling, no save button (autosave), no tax form.

### Per-settings-page treatment

| Page | Pattern |
|---|---|
| `/dashboard/settings/account` | Avatar + display name + handle + 4–6 fields. Hero: the avatar with brand-accent gradient. Inline edit on click; no separate form. |
| `/dashboard/settings/payments` | Hero: Stripe Connect status (connected / pending / not connected). Below: payout schedule cards. No tax form because Stripe Connect *is* the payment configuration — Tahti's job is showing the state and one action ("Manage in Stripe ↗"). |
| `/dashboard/settings/fan-subs` | Hero: current tier card with subscriber count. Below: tier edit using direct manipulation (price slider, tier name field, perks as togglable cards). |
| `/dashboard/settings/multistream` | Already mocked correctly (`12-import-mixcloud-rescue.png` pattern). Per-target row with status pill — instrument, not form. |
| `/dashboard/settings/notifications` | Three big toggle cards with email previews per above. |

A settings page that can't be redesigned to this pattern probably shouldn't exist — fold its fields into the relevant feature surface (e.g., privacy controls live in the channel designer, not in a separate page).

### Enforcement heuristic (code review)

Per view, count:

- `labelInputPairs` = number of `<Label>` immediately followed by an input element
- `heroElements` = elements explicitly marked `data-hero` (every view must have at least one)
- `visualNonFormElements` = covers, waveforms, gradients, illustrations, KPI numbers, previews
- `primaryActions` = visible `Button` with `variant="primary"`

The view is a tax form if any of these:
- `heroElements === 0`
- `labelInputPairs > 5 && visualNonFormElements < 2`
- `primaryActions === 0` OR primary action is below the fold (`getBoundingClientRect().top > viewport.height`)

PR reviewers run a quick mental check against these on every screen.

## Rule 4 — every button is a standard, big, icon button

### Why this rule exists

A sweep of `app.tahti.live` found dozens of `<button className="ui-btn ui-btn--primary">` call sites across the dashboard with no size modifier applied. Both button stylesheets (`admin-ui.css`, `brand-studio.css`) put all padding on the size modifier classes (`.ui-btn--sm/md/lg`) and none on the base `.ui-btn` rule — so any call site that forgot the modifier rendered a button with zero padding: a blue/cyan smear of background color hugging the text with no click target to speak of. That is a correctness bug, not a taste issue, and it shipped because there was no single button component enforcing it.

### What it means concretely

1. **One component, one size.** Every actionable control renders through the shared `Button` component (`packages/ui/src/admin/button.tsx` for the dashboard/admin surfaces, `packages/ui/src/brand/Button.tsx` for public/channel pages) — never a raw `<button className="ui-btn ...">` or `<a className="ui-btn ...">` typed out by hand. Hand-typed class strings are exactly how the padding bug happened; they drift the moment someone forgets a modifier.
2. **Big is the default, not an opt-in.** Standard button height is **44px** (`--btn-h` in `reference/tokens.css`), padding `0 20px`. This is what renders when no size is specified — the base `.ui-btn` / `.brand-btn` rules carry this padding directly so a missing size modifier can never produce an unpadded button again. `sm` (36px) is the only smaller size, reserved for dense inline contexts (table row actions, chip-like toggles) — it must be an explicit, deliberate choice, never the accidental default.
3. **Icon + label, not label alone.** Every primary and destructive action button carries a leading icon (16×16, inline SVG, matching the hand-drawn icon style already used in `SidebarNav.tsx` / `StudioTopNav.tsx` — the app has no icon font/library, and this rule does not introduce one). Rationale: an icon gives the button a recognizable silhouette at a glance, before the artist reads the label — same reason the Go Live and End Broadcast buttons already do this in the mockups (`⏹ End Broadcast`, `♥ Subscribe`). Secondary/tertiary buttons and plain inline links are the exception — icons are for actions the artist needs to find fast, not every clickable thing.
4. **No color-only variants.** `variant` communicates intent (primary/secondary/danger/ghost) via both color *and* the icon; a button is never distinguished from surrounding text only by a link-blue color with no border, padding, or background.

### Migration status (be honest about scope)

This rule was retrofitted onto an app with ~60 existing hand-typed `ui-btn` call sites in `apps/web/src/app/dashboard/**` (plus a handful in `signup/`, `login/`, `governance/`, `admin/`). Two passes are done, one remains:

- **Done — the padding bug**: base `.ui-btn`/`.brand-btn` now carry the big/44px padding directly, so every call site is visually correct even without touching the markup.
- **Done — the icon pass**: every primary and destructive button across the app now renders a leading `ButtonIcon` (new component, `packages/ui/src/brand/ButtonIcon.tsx`) or the existing `SidebarNavIconSvg` where an equivalent nav icon already existed (e.g. every "upload" action). One icon per action *type* (save, plus, trash, send, link/unlink, check, refresh, download, arrowRight, heart, import, play, edit, search) reused across buttons that do the same kind of thing, not a bespoke glyph per button. A few buttons were left as-is because their label already carries an equivalent glyph (`+ Add`, `✓ Added`, `● Go live`) — adding a redundant icon there would double up, not clarify.
- **Not done — component consolidation**: the buttons above are still hand-typed `className="ui-btn ui-btn--primary"` markup, not the shared `<Button>` component. Migrate opportunistically when a file is touched for other reasons; don't do a mechanical drive-by rename with no other benefit.
- **Separately found, not fixed here**: a second, older button class family (`studio-btn-primary` / `studio-btn-ghost` / `studio-btn-danger`, ~17 files) duplicates `ui-btn` outside this sweep's scope. That's its own consolidation follow-up — don't fold it silently into unrelated work.

### Enforcement

```bash
# Any hand-typed ui-btn/brand-btn className outside the Button components themselves
# is a Rule 4 violation waiting to happen — flag it in review.
grep -rn 'className="ui-btn\|className="brand-btn' apps/web/src --include="*.tsx" \
  | grep -v 'packages/ui/src'
```

> **Rule 4 check**: Does this button render through the shared `Button` component? Is it the standard big size unless there's a specific, stated reason for `sm`? Does a primary/destructive action have a leading icon?

## Existing views — audit against the four rules

Quick assessment of each conformance-spec view against the new rules. The agent runs this audit and produces a fix list before the conformance pass.

### Likely-passing today (verify in audit)

- Dashboard hero-first (`02`): hero present, primary action above fold, no scroll. ✅ Verify in 1440×900.
- Audio editor (`16`): exempt from Rule 1, passes 2 (everything visible), passes 3 (waveform is hero). ✅
- Broadcast live mode (`07`): hero, primary action, no tax form. ✅ Verify no scroll.
- Stats reframe (`09`): hero number, narrative, follow-ups. ✅
- Channel designer (`08`): live preview is hero; controls don't tax-form because of split layout. ✅ Verify no scroll at 1440×900.

### Likely failing — fix list

- **Broadcasting Setup step 3** (`05`): Self-monitor card + show-name + visibility + simulcast + pin-to-chat. This is dense; might scroll on 1440×900. Audit: count vertical pixels in the mockup, scale to 1440×900, check fit. If overflow, either move "Pin to chat" to step 4 OR make the self-monitor card more compact.
- **Mixcloud rescue** (`12`): banner + list. If the list has many items, scrolls. Fine — list scrolls inside its own card, the page itself doesn't scroll. Verify the card uses internal `ScrollArea` from shadcn, not page scroll.
- **Collection editor mixed sources** (`14`): sidebar + tracks list. Tracks may exceed visible area. Fix: track list scrolls inside its container, not the page.
- **Stats** (`09`): hero + narrative + 3 follow-ups + engagement units. Tight. Audit pixel-by-pixel.
- **Settings pages** (all): inventory each one and check against Rule 3 anti-pattern. Most current settings pages will fail; rewrite to the instrument pattern above.

### Genuinely uncertain — design call needed

- **`/dashboard/upload/:uploadId` in-progress view**: upload progress + metadata form + smart-link section + footer actions. Probably exceeds viewport. Options: (a) collapse smart-links into a popover or separate step, (b) make metadata fields denser, (c) accept scroll on this one view as a justified exception.

  **Recommendation**: option (a). The upload-in-progress view should be focused on watching the upload + extracting metadata. Smart links can be added on the post-upload review screen, which is its own view that *also* fits in one screen.

## Updated conformance checklist

Add to `tahti-conformance-spec.md` §3 (per-view conformance procedure):

```
Step 9 — Rule 1 (no scroll) check
  ☐ At 1440×900 viewport, document.body.scrollHeight <= 900
  ☐ Exception applies (in the explicit list above) — note which

Step 10 — Rule 2 (manageable from one screen) check
  ☐ No tabs splitting the view's primary task
  ☐ No accordions hiding primary actions
  ☐ All controls relevant to the current task are visible simultaneously

Step 11 — Rule 3 (not a tax form) check
  ☐ At least one element marked data-hero, occupying ≥30% of viewport height
  ☐ Primary action visible without scrolling
  ☐ Label+input pairs are not the dominant visual content
  ☐ Direct manipulation used where possible (sliders, swatches, toggles) over text entry
  ☐ Live preview of consequence where applicable (channel designer pattern)

Step 12 — Rule 4 (standard, big, icon buttons) check
  ☐ Every button on the view renders through the shared Button component, no hand-typed ui-btn/brand-btn classNames
  ☐ Standard (big, 44px) size used unless sm is a deliberate, stated choice
  ☐ Primary/destructive actions carry a leading icon
```

A view passes the conformance gate only when steps 1–12 all check.

## Implementation order

If retrofitting these rules onto the existing implementation:

1. **First pass**: enforce Rule 1 mechanically. Add the no-scroll Playwright suite. Run against current branch. Get the fail list.
2. **Triage**: for each failing route, decide: (a) redesign for density, (b) add to allowed-exceptions list with justification, (c) split into multiple routes.
3. **Second pass**: audit each route against Rules 2 and 3. Most fixes are *removals* — strip a tab, replace a stacked form with cards, add a hero where missing.
4. **Update mockups**: where the redesign changes a view substantially, re-render its reference screenshot. The conformance spec PR includes both the implementation and the updated reference.

## The honest cost

These rules will surface that some existing routes were not actually designed — they were assembled from form components. The redesign work is real. The benefit is real too: every shipped view becomes a tool, not a configuration screen.

Budget estimate for the rule enforcement pass: 2–3 days for the no-scroll mechanical fixes, plus 3–5 days for the tax-form redesigns (mostly settings pages, which are most numerous). Less time than fixing the same problems individually after launch.

## Stop and ask Long if

- A route genuinely cannot be designed to fit 1440×900 without losing critical content — propose the exception with reasoning, don't silently add to the allowed list.
- A settings page resists the instrument pattern (e.g., something like billing history with N entries genuinely needs to be a list). Pagination + filter is the answer; the *header* must still pass the rules.
- The no-scroll rule conflicts with a feature requirement (e.g., a long-form newsletter editor needs vertical space). Propose specific exemption with bounds (the editor textarea scrolls internally; the surrounding chrome fits).
- The hero element requirement feels forced on a particular page — that's usually a signal the page shouldn't exist as its own route. Propose folding it into another view.

## Out of scope for this brief

- Mobile-specific layouts beyond the "hero fits above fold" assertion. Mobile design language is a separate workstream.
- Touch interaction patterns. The instrument-over-form preference applies, but the specifics (large hit targets, swipe gestures) are not detailed here.
- Animation rules. Where the channel designer says "changes apply within ~100ms" — that's already in the brief. Larger motion design (page transitions, success animations) is separate.

This brief makes density and character *mechanically enforceable* the same way the previous brief made colors and dimensions enforceable. After both are in place, the agent cannot ship a view that scrolls, hides controls behind tabs, or looks like a tax filing form. The constraints converge the design toward what the constitution implies: tools that make artists' work feel powerful, not bureaucratic.
