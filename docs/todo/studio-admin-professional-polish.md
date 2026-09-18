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

### Slice 4 — vendor cards dedup

`admin/settings/vendors/page.tsx`: `CRITICAL_VENDORS` / `INTEGRATION_VENDORS`
/ `INFRA_VENDORS` each rendered a near-identical `<div className="admin-card">`
card with 5-8 inline `style={{}}` props, duplicated three times with slightly
different field shapes (envVars/dpaNote/statusBadge aren't on all three).
Extracted a local `VendorCard` component
(`admin/settings/vendors/vendor-card.tsx`) taking all fields as optional props
and used it for all three lists, removing ~150 lines of duplicated inline
styling. The integration-status badge (previously computed inline via
`integrationStatus.get(v.name)` three times per row) is now resolved once per
row into a `statusBadge` prop.

Minor normalization as a side effect (in the direction of more consistency,
not a regression): infra vendor cards now render their badges/portal-link row
through the same always-present flex wrapper the critical/integration cards
use, instead of the portal link being a standalone block link — matches this
polish pass's goal of one shared shape instead of three near-identical ones.

### Slice 5 — `studio-details` (credits/version panels) onto `StudioCollapse`

Took the "dedicated look" Slice 1 deferred at the two `studio-details`
users, `release-track-credits-panel.tsx` and `release-track-version-panel.tsx`.
Both render as plain siblings inside an unstyled `<div key={t.id}>` per track
(`releases/[id]/_release-detail.tsx`) — no existing card wrapper — so
`StudioCollapse`'s own card chrome becomes the section boundary instead of
double-nesting inside another card. Converted both to
`<StudioCollapse title={...}>`, following the existing precedent of
interpolated titles (`admin/dashboard/page.tsx`'s `` `Live now (${count})` ``).
The version panel's `open={versions.length === 0}` (forced open/closed every
render) became `defaultOpen={versions.length === 0}` (set once, from the
initial fetch) — deliberate, not incidental: it means the panel no longer
snaps shut the instant a track's first version finishes uploading, which reads
as the intended behavior rather than the old one. Removed the now-dead
`.studio-details summary` CSS rule from `brand-studio.css` (its only two
callers were these two files).

Left the other four `<details>` alone after inspection, confirming Slice 1's
call was right for each:

- `sound-list__tools` (`sound-editor-row-tools.tsx`): an icon-button dropdown
  menu, not a content panel — `StudioCollapse`'s title/hint/chevron layout
  doesn't apply.
- `broadcast-studio__preflight-more` (`_broadcast-studio.tsx`,
  `_step3-preflight.tsx`) and `studio-add-show__more`
  (`channel-schedule-add-show.tsx`): styled as a flush `border-top` divider
  _inside_ an existing form/card, not a standalone card — wrapping them in
  `StudioCollapse`'s own bordered/backgrounded chrome would nest a card inside
  a card. Needs a screenshot check before touching; deferred.
- `two-factor-panel.tsx`'s bare `<details>`: a one-line "show more text" hint,
  too small for `StudioCollapse`'s card-sized affordance.

### Slice 6 — admin nav / governance records panel review

Reviewed both files named in the previous Leftovers entry:

- `admin-nav.tsx` (558 lines): almost entirely a data table of 30 unique
  inline SVG icons plus already-factored nav/lookup logic
  (`db-nav-item`/`db-nav-primary` classes, a `menuItem` lookup helper, a
  `GovernanceNavIcon` helper already deduping the plain letter-mark icons).
  No inline `style={{}}` clutter, no repeated card markup — its size is
  inherent to 30 distinct icons, not an anti-pattern this pass targets.
  Left alone; nothing to extract.
- `agm/governance-records-panel.tsx` (684 lines, 20 `style={{}}` occurrences):
  found two real dedup targets and fixed both. The "New meeting" and "New
  document record" forms each ended their grid with the same
  full-width-label / checkbox-label / submit-button trio
  (`marginTop: '0.65rem'`, repeated 5 times across the two forms) — moved to
  `.admin-governance-records__field--full`, `__checkbox-field`, and
  `__submit` in `admin-shell.css`. The per-meeting agenda/attendance/notice
  sub-sections each opened with `<p className="admin-stat-sub" style={{
marginBottom: '0.35rem' }}>` (3x) and rendered their record rows with
  `style={{ fontSize: '0.8125rem', margin: '0.2rem 0' }}` (2x) — moved to new
  scoped `__section-label` / `__record-row` classes (kept `admin-stat-sub` on
  the label rather than folding its rule in, since that shared class has 117
  other callers across the app).

  Left the remaining ~10 `style={{}}` occurrences in the meetings table
  (per-column formatting: muted type-label cell, state `<select>` width,
  scheduled/quorum cell font-size) alone — each appears exactly once in the
  JSX (the table row template), so there's no source-level duplication to
  remove; a CSS-class version would be more fragile (`nth-child` column
  targeting) than the inline styles it'd replace.

## Verified

- `pnpm --filter @tahti/ui typecheck` — clean
- `pnpm --filter @tahti/ui lint` — clean
- `eslint` scoped to all touched `apps/web` files (Slices 1, 4, 5, 6) — clean
- `prettier --write` run on every changed file (all now formatted)
- Full `apps/web` `tsc --noEmit` could not be run in this worktree: generating
  `packages/api-client/src/schema.d.ts` requires `apps/api`'s openapi export,
  which hangs waiting on a live Postgres connection this sandboxed worktree
  doesn't have. Neither `apps/api` nor `packages/api-client` changed in this
  pass, so per the repo's own pre-push rule this regenerate step isn't
  required here — flagging so the next session doesn't assume it was skipped
  by accident.
- No dev server / browser check in this worktree (sandboxed, no live
  Postgres) — the Slice 5 visual claims (no nested-card risk for the two
  converted files; nested-card risk for the three deferred ones) and the
  Slice 6 CSS-class swaps are from reading the CSS and parent markup, not a
  rendered screenshot.

## Leftovers (next slices)

- **Deferred `<details>` variants**: `broadcast-studio__preflight-more` (x2)
  and `studio-add-show__more` — visually verify (screenshot or running app)
  whether nesting `StudioCollapse` card chrome inside their existing
  form/card actually looks wrong before converting; `sound-list__tools` and
  `two-factor-panel.tsx` are out of scope regardless (menu / too-small hint).
- **Largest remaining studio files** (still very large, not touched this
  pass): `pro-audio-editor.tsx` (806), `social-promo-panel.tsx` (576),
  `sound-editor.tsx` (573) — mostly already sliced by
  `split-god-classes.md`; further work there is size/structure, not
  component-reuse.
