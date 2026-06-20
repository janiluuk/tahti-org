# Tahti — closing the design gap

This is a **methodology brief**, not a design spec. You already have the design specs:

| Source                                         | Role                                            |
| ---------------------------------------------- | ----------------------------------------------- |
| **9 v8 mockup screenshots** (`screenshot.zip`) | Visual ground truth — wins over everything else |
| `docs/CONSTITUTION.md`                         | Three rules — wins over UX preferences          |
| HTML mockups (Claude visualizations)           | Spacing, structure, typography hierarchy        |
| `docs/design-system.md` + `docs/AGENT.md`      | Tokens, components, journeys                    |
| **This file**                                  | Working method                                  |
| Existing code (e.g. open PRs)                  | Evolve, don't replace wholesale                 |

**Conflict order:** mockup → constitution → HTML mockups → design-system → this file → existing code.

If anything here contradicts a mockup, the mockup wins. If a mockup contradicts the constitution, stop and ask.

---

## Repo-specific notes

This monorepo does **not** use Tailwind for brand UI. Tokens live in:

| Layer                       | Location                                                       |
| --------------------------- | -------------------------------------------------------------- |
| **TS source of truth**      | `packages/ui/src/tokens.ts`                                    |
| **CSS custom properties**   | `packages/ui/src/tokens.css` (must match `tokens.ts`)          |
| **Components**              | `packages/ui` (`@tahti/ui`) — never duplicate under `apps/web` |
| **Machine-readable export** | `docs/design-tokens.json`                                      |

Import CSS once per surface — see `.cursor/rules/ui-library.mdc`.

---

## Stop building pages

Freeze page-level implementation until these are locked:

1. **The token table** (`packages/ui/src/tokens.ts` + `tokens.css`)
2. **The primitive component library** (`/dev/components` playground)

Pages are downstream composition. Without locked tokens and primitives, every page drifts.

---

## Phase A: Lock the token table

### A.1 Canonical token file

`packages/ui/src/tokens.ts` — complete v8 table. No hex in components except via tokens or CSS vars.

### A.2 CSS wiring (not Tailwind)

`packages/ui/src/tokens.css` maps `--bg`, `--card`, `--amber`, `--text-stat-big`, etc. to the same values as `tokens.ts`. After edits to either file, run:

```bash
pnpm --filter @tahti/ui lint
grep -rn '#[0-9a-fA-F]\{3,8\}' packages/ui/src --include='*.tsx' --include='*.ts' | grep -v tokens.ts
```

### A.3 Forbid raw hex in TS/TSX

Root ESLint `no-restricted-syntax` blocks literal hex in `.ts`/`.tsx` except allowlisted token/admin/test files. CSS hex belongs only in `tokens.css` (and admin token files).

### A.4 Sweep

Migrate stray hex in components to tokens or `var(--…)`. Platform brand colors (Spotify green, etc.) may use `/* design-token-allow: … */` in CSS.

### Phase A acceptance

- [ ] `packages/ui/src/tokens.ts` exists with complete v8 table
- [ ] `tokens.css` matches `tokens.ts`
- [ ] ESLint blocks new raw hex in components
- [ ] TS/TSX hex sweep clean (allowlisted exceptions only)
- [ ] `pnpm ci:check` passes

**Do not start Phase B until all five are checked.**

---

## Phase B: Design playground

Route: `apps/web/src/app/dev/components/page.tsx`

- Dev-only (`notFound()` in production)
- One section per primitive/composite
- **This is the iteration target** — verify here before user-facing routes

Start dev server → open `/dev/components` → compare side-by-side with v8 mockup.

---

## Phase C: Primitives (order matters)

1. Tokens (Phase A)
2. Typography utilities
3. Button (primary, secondary, warn, danger)
4. Pill / Badge
5. Input
6. CoverArt
7. AvatarTile
8. StatCard (plays, downloads, fans, revenue)
9. PinnedAnnouncement
10. BrowserFrame (mockup-only)
11. WaveformPlayer
12. LiveChatPanel
13. BroadcastStatusBar
14. SidebarNav

**Per primitive:** mockup → implement → playground → visual compare → next.

Do not declare done without rendering on `/dev/components`.

---

## Phase D: Composites

DashboardShell, ChannelPageShell, PublicShell, AdminShell, ReleaseSmartLink, TierCard — same workflow as primitives.

---

## Phase E: Pages

Only after C + D. Pages compose shells + primitives; minimal inline styling. Target &lt;100 lines of JSX per page file.

---

## Mockup-comparison protocol

For each component or page:

1. Open v8 mockup (1280×800 desktop; 375×812 mobile)
2. Render implementation at same viewport
3. Screenshot (Playwright optional — see `scripts/capture-e2e-screenshots.mjs`)
4. Compare: **backgrounds → typography → accent colors → spacing → composition**

Goal: visually indistinguishable at first glance, not pixel-perfect.

---

## The five invariants

When done:

1. `tokens.ts` + `tokens.css` are the only brand hex sources
2. Every visual variant lives in the component (variant prop, not page `className` overrides)
3. Every page composes named components — no raw `#11172A` divs
4. `/dev/components` shows every primitive and composite
5. User-facing pages have screenshot tests in `docs/e2e-screenshots/`

---

## Order of operations

```
1. Lock tokens
2. Build playground (/dev/components)
3. Primitives (verify each vs mockup)
4. Composites
5. Pages
6. Verify five invariants
```

Out-of-order work causes drift. If you're on step 5 and the primitive is missing, go back to step 3.

---

## When to stop and ask

- Ambiguous mockup detail
- Page with no mockup (admin flows)
- Existing code vs mockup conflict
- New palette token
- Money paths (Stripe, fan-sub payouts, grants)

Don't ask about: file names, `gap-3` vs `gap-4`, obvious token-scale spacing.
