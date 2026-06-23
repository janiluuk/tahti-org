# Tahti — the literal-reference method (how to stop interpretive implementation)

## What this brief fixes

The previous briefs (design-system-enforcement, ground-rules, conformance-spec) address *consistency*, *density*, and *verification*. They do not address the failure mode visible in the latest broadcast-studio screenshot: **the agent is interpreting the mockup, not implementing it**.

That screenshot shows seven separate concerns combined into one route (credentials + design link + schedule + 24/7 rotation + next-broadcast + multistream + distribution), when the spec called for *one concern per view* across four routes. The agent looked at the mockup, decided what features "should" be there, and built that. The mockup said one thing; the implementation says another. No styling rule catches this.

This brief installs the working method that makes interpretive implementation impossible: **the mockup HTML becomes the structural spec, not the PNG**.

## What's in the pack

`tahti-html-references.zip` contains 16 files, one per mockup:

```
01-dashboard-current.html          # before, what to fix
02-dashboard-proposed.html         # the dashboard target
03-broadcasting-step-1-credentials.html
04-broadcasting-step-2-test-signal.html
05-broadcasting-step-3-preview.html
06-broadcasting-step-4-go-live.html
07-broadcast-live-mode.html
08-channel-designer.html
09-stats-reframe.html
10-archive-focused-rows.html
11-import-google-drive.html
12-import-mixcloud-rescue.html
13-spotify-search-add-to-collection.html
14-collection-editor-mixed-sources.html
15-public-collection-mixed-sources.html
16-pro-audio-editor-v3-2.html
INDEX.md
```

Each HTML is a complete, self-contained document — open in any browser to see it render exactly as the corresponding PNG. The HTML includes inline CSS using v8 tokens (canonical). No build step required.

These files are the **structural ground truth**. The PNG shows what a view *looks like*; the HTML shows what a view *is*. The HTML is what the agent must replicate.

Commit the pack to `docs/reference-html/` in the repo alongside `docs/reference-screenshots/`.

## The literal-reference method (the working contract)

When implementing or fixing any of the 16 routes, the agent operates under three rules. None are advisory. None have exceptions.

### Rule A — structure-match the reference HTML

The reference HTML defines what's on the page. The React implementation must produce **the same DOM structure** when rendered:

- Same top-level layout containers (`.bw` → shell, `.layout` → grid)
- Same sections in the same order
- Same hierarchy of cards / lists / form groups
- Same element types serving the same roles (a button is a button; a status pill is a pill)
- Same explicit dimensions where the HTML specifies them (sidebar 130/220px, content padding 14–18px, etc.)

Classnames don't have to match verbatim — the React implementation uses Tailwind utilities mapped through `tailwind.config.ts` (per the design-system-enforcement brief). But the *visual outcome* of the classes must equal the reference HTML. If the reference uses `background: #162038` and `border: 1px solid #1F2940`, the React equivalent is `bg-bg-elevated border border-border-subtle` — different syntax, identical pixels.

### Rule B — do not add what is not there

If the reference HTML for a route contains 6 elements, the React implementation has **exactly 6 elements** doing the same job. No extra sections. No "while we're here" features. No related-functionality additions.

The broadcast-studio screenshot violates this rule six times:
1. Adds a "Channel design" card (belongs at `/dashboard/channel/edit`, not here)
2. Adds "Schedule & programme" (separate concern; not in mockup 03)
3. Adds "24/7 archive rotation" (separate concern; not in any current mockup)
4. Adds "Next broadcast" scheduling (separate concern; if Tahti needs this, it gets its own route)
5. Adds "Multistream" (has its own route `/dashboard/settings/multistream`)
6. Adds "Distribution & chat" (also belongs elsewhere)

Each of those is plausibly useful. Each of those is also why the page looks like a tax form. The fix is not to redesign them — it's to **remove them from this route entirely**. They live where the conformance spec routes them.

If the agent believes a feature is missing, the agent asks Long. The agent does not add it silently.

### Rule C — do not remove what is there

The mirror image. If the reference HTML contains an element, the React implementation contains it. The agent does not decide a section is unnecessary, redundant, or implementation-pending and skip it.

Particularly: honesty banners, quality labels, constitutional copy. The mockup shows them; the implementation shows them. The exact words in the mockup are the exact words in production (the `tahti-import-sources-brief.md` flags this explicitly for the Spotify/Mixcloud banners; the same applies to the broadcasting-setup explanatory copy, the upload tier-limit messaging, the engagement-units description).

## How the agent uses these files

### Workflow per route

1. **Open** the matching `docs/reference-html/{NN}-{name}.html` in a real browser. Resize to the target width (most are 720px; 920px for channel designer / collection editor / live mode; 1080px for the audio editor — `meta viewport` declares each).
2. **Inspect** the DOM. The element hierarchy is the spec. Note: top-level layout containers, section order, card boundaries, button placements.
3. **Read** the same row of the conformance-spec route table for the corresponding brief reference and brief section.
4. **Implement** in React. The reference HTML and the brief together are the complete spec. If they disagree on anything, stop and ask Long — do not invent a resolution.
5. **Diff** the implementation against the reference HTML when both are rendered side by side at the target viewport. Differences in spacing, color, alignment, weight are bugs. Differences in *what's on the page* are violations of Rule B or C.
6. **PR** with both impl screenshot and the reference HTML's screenshot attached. Reviewer sees both in the PR description.

### When the reference HTML and the brief disagree

The reference HTML wins on structure (what's on the page, in what order, at what dimensions). The brief wins on behavior (what happens when the artist clicks, what data populates which fields, what API calls fire, what state transitions occur). They should not disagree on visual outcome — if they do, the reference HTML is the truth and the brief is updated.

## The specific case — fixing `/dashboard/broadcast`

Concrete walk-through using the latest screenshot, to anchor the method.

**Current state (as shown in the screenshot):** one route at `/dashboard/broadcast` containing credentials + channel design + schedule + 24/7 rotation + next broadcast + multistream + distribution. Stream key in cleartext. Free-tier limit gauge pinned top. Forward button amber instead of cyan.

**Target state (from `03-broadcasting-step-1-credentials.html` through `06-broadcasting-step-4-go-live.html`):**

- **Four separate routes**: `/dashboard/broadcast?step=1` through `?step=4` (or `/dashboard/broadcast/credentials`, `/test-signal`, `/preview`, `/go-live` — pick one URL scheme and stay consistent).
- **Each route contains only its own step's content.**
- **Step 1** (route `?step=1`): stepper at top showing 1 current / 2,3,4 next. Page contains: title "Your stream credentials", subtitle, RTMP card (with masked stream key + Copy button + Rotate link), Icecast card (same pattern), footer with "Broadcasting guide" link on the left and cyan `Next: test signal →` button on the right. That's it. Nothing else.
- **Step 2** (route `?step=2`): stepper showing 1 done / 2 current / 3,4 next. Page contains: title, live signal card (level meters, codec/sample-rate/latency), footer with `Next: preview →`. That's it.
- **Step 3** (route `?step=3`): stepper 1,2 done / 3 current / 4 next. Self-monitor card, broadcast setup form (show name + visibility + simulcast + pin-to-chat), footer `Next: go live →`.
- **Step 4** (route `?step=4`): stepper all-but-last done. Centered hero "Ready when you are", giant green `GO LIVE NOW` button, summary card.

**Things removed from this route entirely** (live elsewhere):
- Channel design link → `/dashboard/channel/edit` (its own sidebar item)
- Schedule & programme → if this exists as a feature, it's a separate page like `/dashboard/schedule`. Decide after audit; do not bolt it on here.
- 24/7 archive rotation → if this exists, also separate. Most likely a section in `/dashboard/archive` or `/dashboard/channel/edit`.
- Next broadcast scheduling → folds into the Step 3 metadata form (show name + datetime) OR a separate `/dashboard/schedule` route. Pick after asking Long.
- Multistream → already has `/dashboard/settings/multistream`.
- Distribution & chat → already covered by other routes (multistream + the channel page).

**Security bug, fix in same PR**: the stream key in the screenshot displays in cleartext. The mockup HTML shows `value="••••••••••••••••••••"` with `readonly`. Implement the masking + a click-to-reveal pattern. Never render the secret in the DOM as visible text on first paint.

**Color bug, fix in same PR**: the "Continue to test signal →" button is currently amber (`#FFB840` warn color). The reference HTML uses class `bp` which is cyan (`#22D3EE` brand). Amber is reserved for caution / warning; never use it on a forward primary action.

**Free-tier "60:00 weekly" gauge**: not on the broadcasting setup view. If it must surface somewhere, it goes on the dashboard hero as a small subtitle ("free tier · 47 minutes left this week") OR appears as a banner only when the artist is within 5 minutes of the cap. Not pinned to every broadcast route.

## What "done" looks like for this route

After the fix:
- Four routes render the four steps. Navigating `?step=1` → `?step=2` advances the stepper visibly and changes the page content.
- Each step at 1440×900 fits without scrolling (ground-rule #1).
- Each step contains exactly the elements in its reference HTML (Rule A + B + C).
- Stream key is masked until clicked.
- All buttons use the correct meaning-bound colors.
- The conformance test (`packages/ui-test/conformance.spec.ts`) screenshot-diffs each step against `03-`, `04-`, `05-`, `06-` and passes within 2% threshold.

## Per-PR workflow (the discipline that prevents regression)

Every PR that touches a route in the conformance spec must include:

1. **The reference HTML rendered to a screenshot** at the target viewport (use the existing render script).
2. **The implementation rendered to a screenshot** at the same viewport.
3. **A diff image** generated by Playwright.
4. **A statement of what was added or removed from the reference**, if anything. If "nothing," say so explicitly.

PR template:

```markdown
## Route
`/dashboard/broadcast?step=1`

## Reference
`docs/reference-html/03-broadcasting-step-1-credentials.html` (rendered: `docs/reference-screenshots/03-broadcasting-step-1-credentials.png`)

## Implementation
`apps/web/src/app/dashboard/broadcast/page.tsx` (rendered: attached screenshot at 1280×900)

## Additions over reference
None / [list]

## Removals from reference
None / [list]

## Diff
Visual diff: [attached PNG]
Layout test: passing / failing → fixed in commit X
Screenshot diff: 0.8% (below 2% threshold)

## Behavior verified
[checklist of behaviors per brief]
```

A PR without these four artifacts is not reviewed. The reviewer's first question is "does the implementation match the reference HTML?" — answered visually, not by reading code.

## What this brief does not do

- Doesn't replace existing briefs. Those define behavior, data shapes, security constraints. This brief defines the *structural* contract.
- Doesn't lock the HTML forever. When the design genuinely evolves, the reference HTML evolves with it — same PR, same review. The point is that the HTML is *committed* and *named*, so drift is visible in `git log`.
- Doesn't prevent the agent from asking questions. The agent should ask Long *more* now, not less. "The reference HTML doesn't show a way to do X — should I add it, or does X belong on a different route?" is the kind of question that prevents the broadcast-studio sprawl.

## Three rules, summarised

A. **Structure-match the reference HTML.** Same hierarchy, same elements, same visual outcome.

B. **Do not add what is not there.** If the agent wants to add a feature, the agent asks. If Long says yes, the reference HTML is updated first; then the implementation matches the new reference.

C. **Do not remove what is there.** Especially honesty banners, quality labels, and constitutional copy. Mockup says it, production says it.

If these three rules are followed, the next screenshot looks like the mockup. If they're broken, every screenshot will continue to look like a tax form, regardless of how many design tokens are locked or shells are built.

## Stop and ask Long if

- The reference HTML and the brief disagree on what's on a page.
- A genuinely needed feature has no home in any of the 16 reference HTMLs.
- A feature in production has no corresponding mockup at all (i.e., it was added at some point without going through the design loop). Inventory it; decide to formalise or delete.
- Multiple routes seem to overlap (e.g., is "next broadcast scheduling" part of broadcast setup, channel design, archive, or its own route?). The answer is for Long, not for the agent.
- The reference HTML targets a smaller viewport than the implementation supports (mockups are 720–1080px wide; production is 1280px+). The shell-based layout from the design-system-enforcement brief handles the scale-up; the *content* doesn't change.

The combination of this brief, the design-system-enforcement brief, and the ground-rules brief produces a closed loop: tokens enforce color/spacing, shells enforce layout, the no-scroll/no-tax-form rules enforce density, and the literal-reference method enforces what's actually on the page. After all four are in place, the broadcast-studio screenshot becomes impossible to ship.
