# Documentation staleness audit (2026-09-01)

## Scope

Swept `docs/` for content that no longer matches the actual state of the
project — infra decisions, technical architecture, ops references — as
opposed to business/strategy docs, which need editorial judgment rather
than a fast cross-check and were mostly left for a follow-up pass. Used
git commit dates as a staleness signal (anything untouched since roughly
mid-August), then read and cross-checked the flagged candidates against
current code and other docs.

Excluded from this pass: `docs/governance-worklog.md` and
`docs/remaining-work.md` (both being actively edited in a concurrent
session at the time of this audit), everything under `docs/worklogs/`
(historical logs, not meant to read as current), and `docs/e2e-screenshots*/`
(generated artifacts).

## Fixed

- **`docs/cdn-strategy.md`** — the entire document was a vendor comparison
  recommending Bunny CDN as primary, which directly contradicts the actual
  decision recorded in `docs/infra-strategy.md` ("No CDN. Bunny, Fastly,
  Cloudflare, BlazingCDN, AWS CloudFront — none."). Added a superseded
  banner at the top pointing to `infra-strategy.md` as the current source of
  truth, and left the original vendor research below intact as historical
  context (useful if the CDN question is ever reopened at the Y3
  bandwidth-vs-fiber decision point `infra-strategy.md` itself calls out).
- **`docs/technical/worker-crons.md`** — listed only 10 of the 26 real cron
  jobs in `packages/shared/src/worker-cron-jobs.ts`, and pointed at
  `apps/worker/src/cron-manifest.ts` as the source of truth when that file
  is now just a thin re-export. Rewrote the table with all 26 jobs (name,
  schedule, one-line note) and corrected the manifest location. Missing
  jobs included several that matter operationally if someone's debugging
  live playback: `channel-watchdog`, `radio-slot-switchover`,
  `channel-fallback-reconciler`, `hls-minio-sync`, `hls-caddy-egress-sync`,
  `archive-fallback-cache-sync`, `sidecar-cleanup`.

## Checked, found not actually stale

- **`docs/technical/journey-artist.md`** (and presumably the sibling
  journey-director/listener/member/ops.md files, same commit date) —
  flagged for saying "across all seven delivery phases" when
  `docs/technical/phase-*.md` now runs 1–12. Traced this through:
  `docs/delivery-phases.md` (infra/launch rollout) covers exactly phases
  1–7 plus 6b, so "seven delivery phases" accurately describes that
  document's own scope. Phases 8–12 are a separate series covering
  post-MVP product features (profiles/releases, newsletter, community,
  engagement, admin panel) — already correctly listed in
  `docs/technical/overview.md`'s phase gantt under "Post-launch features"
  and "Operations & Governance", not "delivery." Not a real inconsistency;
  no edit made.
- **`docs/technical/overview.md`** — initially suspected this might be
  missing phases 8–12 from its own phase timeline; it isn't. It already
  lists all of phases 0–12 and carries its own "not current status, see
  project-roadmap.md" disclaimer plus a correct, current CDN/hosting policy
  section. No edit made.
- **`docs/infra-strategy.md`, `docs/hosting-budget.md`,
  `docs/hosting-budget-home-2026-2027.md`, `docs/scaling-node-distribution.md`**
  — consistent with the real local-colo/Hetzner-HEL1/no-CDN decision.
- **`docs/technical/rate-limit-policy.md`** — checked against
  `apps/api/src/plugins/rate-limit.ts`; numbers and env vars still match.

## Flagged, not fixed — needs a maintainer call

- **`docs/technical/streaming-architecture.md`** — explicitly frames itself
  as a target/aspirational design ("this document specifies the target
  distributed architecture" vs. "the current monolithic design ... fails"),
  which is an honest framing in itself, not a defect. What's unverified is
  *how much of the target has actually shipped* since this was written on
  2026-06-20 — a fast read of `infra/stack/nginx-rtmp.conf` and the
  per-channel Liquidsoap setup in `docker-compose.stack.yml` wasn't enough
  to confirm whether the tiered edge-encoder / split MinIO segment store
  design is partially built or still fully aspirational. Needs someone with
  current infra context to confirm and, if the gap has narrowed, update the
  framing.

## Not checked in this pass

Business/strategy/governance docs, where "stale" requires editorial
judgment about current org priorities rather than a code cross-check:
`docs/funding-strategy.md`, `docs/profile-and-promo-toolkit.md`,
`docs/tahti-radio-and-venues.md`, `docs/budget-detailed.md`,
`docs/business-evaluation.md`, `docs/cloud-import-roadmap.md`,
`docs/engagement-and-fansubs.md`, `docs/financial-model.md`,
`docs/governance-and-legal.md`, `docs/planning-decisions.md`,
`docs/storage-policy.md`, `docs/strategy-and-product.md`,
`docs/transparency-policy.md`, `docs/obs-and-broadcasting-guides.md`,
`docs/CONSTITUTION.md`, `docs/design/*`, `docs/guides/*` (other than what's
listed above). Worth a second pass if a fuller audit is wanted — these are
mostly old enough (May–June 2026 commit dates) to be worth at least a
skim for factual drift even if they don't need a rewrite.

## Follow-up: admin screenshot inventory

The board-member flow had documented several admin routes as capture gaps even
though their pages already existed. Added the available index routes to both
`scripts/capture-e2e-screenshots.mjs` and `scripts/capture-mobile-screenshots.mjs`:

- news, announcements, radio submissions, missed shows, and top lists;
- disco widgets, themes, and internet radio;
- storage, files, content reports, and feature requests.

Dynamic detail routes remain gaps because they require seeded IDs or a year
parameter (`/admin/users/:id`, `/admin/support/:id`, and
`/admin/grants/:year`). The seeded stack was brought up successfully, but the
full Playwright capture stalled during the public-route pass after capturing
the home and join pages, so no new screenshot inventory or flow links were
created (the two existing PNGs touched before the stop remain as incidental
working-tree changes). Targeted syntax, formatting, lint, and typecheck checks passed;
the repository CI check still fails at its existing design-token gate because
of raw hex colors elsewhere in the UI/CSS codebase.
