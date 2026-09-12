# Studio + admin professional polish

**Status:** in progress on `worktree-studio-admin-professional-refactor` (from latest `main`).

## Goal

Continue the refactor series into the studio (`apps/web/src/app/dashboard`, 39.5k
lines across 100+ files) and admin (`apps/web/src/app/admin`, 11.3k lines)
surfaces: replace ad hoc, one-off markup with the existing `@tahti/ui` shared
component library, remove scattered inline `style={{}}` clutter, and tighten
visual consistency. No new component library was introduced — the existing
`StudioCollapse`, `Panel`, and `Badge` components already cover this ground and
just weren't adopted everywhere.

## Shipped

### Slice 1 — collapsible sections onto `StudioCollapse`

11 files had a hand-rolled `<details className="admin-card studio-details-block">`
(or bare `studio-details-block`) instead of the existing `StudioCollapse`
component (`packages/ui/src/brand/StudioCollapse.tsx`), which already provides
consistent card chrome, a hover state, and a rotating chevron affordance the
raw markup lacked entirely (the old CSS hid the native `<details>` marker and
supplied no replacement, so collapsed sections had zero visual hint they were
expandable). Migrated all 11 to `<StudioCollapse title="…">`:

- `admin/dashboard/page.tsx` (4 — Live now / Queue health / Cron jobs / Recent
  audit events)
- `admin/financial/ledger/ledger-entry-form.tsx`
- `admin/governance/resolutions/resolution-create-form.tsx`
- `admin/agm/governance-records-panel.tsx` (2)
- `admin/agm/page.tsx`
- `admin/settings/vendors/page.tsx` (3 — also dropped a redundant nested
  `admin-card` wrapper inside the GDPR checklist collapse, since the collapse
  body already supplies the card boundary)
- `dashboard/releases-panel.tsx` (2)
- `dashboard/channel-identity-media-section.tsx`
- `dashboard/sound-metadata/{sound-metadata-fields,visuals-fields,advanced-fields}.tsx`
  (4 total)

Removed the now-dead `.studio-details-block` CSS rules from `brand-studio.css`.
Left `studio-details` (a different, unstyled-summary variant used by track
credits/version panels) and the bespoke `broadcast-studio__preflight-more` /
`studio-add-show__more` / `sound-list__tools` details blocks alone — different
shape, lower value to touch in this pass. Two public (non-studio/admin) details
blocks (`listen/_mobile-disclosure.tsx`, `c/[slug]/_sound-list-section.tsx`,
`components/smart-link-release-details.tsx`) are out of scope (not studio/admin).

### Slice 2 — Badge variants + vendor page badges

`packages/ui/src/admin/badge.tsx` only had `live`/`neutral`/`success` variants;
`admin/settings/vendors/page.tsx` was hand-rolling "DPA required" / "Live" /
"Stub mode" chips as one-off `<span style={{...}}>` blocks (6 occurrences,
each duplicating the same padding/radius/font-size). Added `warning` and
`error` variants to `Badge` (mirroring the existing `Alert` component's token
mapping) and swapped all 6 spans to `<Badge variant="…">`.

### Slice 3 — admin dashboard inline-style cleanup

`admin/dashboard/page.tsx`: swapped the plain `<section className="admin-card"><h2>`
Finance YTD block for the existing `<Panel title="…" flushTop>` component;
replaced two `style={{color/fontSize}}` row-title/meta spans with new
`.admin-dashboard-row-title` / `.admin-dashboard-row-meta` classes in
`admin-shell.css`; replaced two `style={{marginBottom:'1rem'}}` one-offs with
the existing `.studio-mb-lg` utility.

## Verified

- `pnpm --filter @tahti/ui typecheck` — clean
- `pnpm --filter @tahti/ui lint` — clean
- `eslint` scoped to all 11 touched `apps/web` files — clean
- `prettier --write` run on every changed file (all now formatted)
- Full `apps/web` `tsc --noEmit` could not be run in this worktree: generating
  `packages/api-client/src/schema.d.ts` requires `apps/api`'s openapi export,
  which hangs waiting on a live Postgres connection this sandboxed worktree
  doesn't have. Neither `apps/api` nor `packages/api-client` changed in this
  pass, so per the repo's own pre-push rule this regenerate step isn't
  required here — flagging so the next session doesn't assume it was skipped
  by accident.

## Leftovers (next slices)

- **Vendor cards dedup** (`admin/settings/vendors/page.tsx`): `CRITICAL_VENDORS`
  / `INTEGRATION_VENDORS` / `INFRA_VENDORS` each render a near-identical
  `<div className="admin-card">` card with 5-8 inline `style={{}}` props. A
  small local `VendorCard` component would remove ~150 lines of duplicated
  inline styling. Deferred — needs care to reconcile the 3 slightly different
  field shapes (envVars/dpaNote aren't on all three).
- **Other `<details>` variants** not touched this pass: `studio-details`
  (`release-track-credits-panel.tsx`, `release-track-version-panel.tsx`),
  `broadcast-studio__preflight-more` (`_broadcast-studio.tsx`,
  `_step3-preflight.tsx`), `studio-add-show__more`
  (`channel-schedule-add-show.tsx`), `sound-list__tools`
  (`sound-editor-row-tools.tsx`), and a bare unstyled one in
  `two-factor-panel.tsx`. Each has interactive content inside its `<summary>`
  or different open/close semantics — worth a dedicated look rather than a
  blind mechanical swap.
- **Largest remaining studio files** (still very large, not touched this
  pass): `pro-audio-editor.tsx` (806), `social-promo-panel.tsx` (576),
  `sound-editor.tsx` (573) — mostly already sliced by
  `split-god-classes.md`; further work there is size/structure, not
  component-reuse.
- **Admin nav** (`admin-nav.tsx`, 558 lines) and the largest admin panel
  (`agm/governance-records-panel.tsx`, 684 lines) not reviewed for
  component-reuse opportunities yet.
