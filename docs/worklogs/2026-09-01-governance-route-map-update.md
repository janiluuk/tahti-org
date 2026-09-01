# Governance route map — correction — 2026-09-01

**Retraction:** this file originally claimed a governance-route migration
(`/admin/governance/audit` → `/admin/logs`, resolutions folded into
`/admin/governance`, `/admin/governance/report` → `/admin/reports`) that was
never actually implemented in code. That claim was propagated into
`docs/design/ground-rules.md`, `docs/flows/board-member.md`,
`docs/technical/phase-12.md`, and both e2e screenshot manifests in commit
`41e4dd04`; all of those were reverted back to the real routes below during
an orphaned/missing-page navigation sweep the same day.

## Actual routes (verified against `apps/web/src/app/admin/admin-nav.tsx`)

- `/admin/governance` — hub page
- `/admin/governance/audit` — governance/business audit log (still separate, still linked as "Governance audit")
- `/admin/governance/resolutions` — board resolutions (still separate, still linked as "Board resolutions")
- `/admin/governance/report` — annual report generator (still separate, still linked as "Annual reports")
- `/admin/logs` — a **different**, unrelated feature: infra/service health log viewer (api, web, worker, postgres, ...). Not a governance page.
- `/admin/reports` — does not exist. No page at this path.
- `/governance/venues` — venue verification (also mislabeled `/admin/governance/venues` in `phase-12.md` before this correction; fixed).
- `/dashboard/governance` and `/governance` (redirects to it) — member governance hub.

## Sweep findings fixed same day

- `/dashboard/channel/text` — fully-built page, orphaned (superseded by the
  inline "Text overlay" section on `/dashboard/channel/edit`, same pattern
  gallery already used). Converted to a redirect.
- `/admin/financial/grants` — stale route in `phase-12.md`; real route is
  `/admin/grants` (+ `/admin/grants/[year]`).

## Sweep findings not yet fixed (need a product decision)

- `/status` — real public status page, no nav or footer links to it anywhere.
- `/transparency/grants/[year]` — linked from both `/transparency` and
  `/admin/grants/[year]`, but no page exists at that route (404).
- `/venues/[slug]` — linked from `_venue-manager.tsx` as
  `/venues/${venue.slug}`, but no page exists there; the link's own label
  text (`{slug}.tahti.live/venues/...`) suggests it may have been meant to
  point at a per-venue subdomain URL instead.
