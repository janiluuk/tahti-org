# Design conformance audit — July 2026

Sweep requested: seed demo content, screenshot every view, and audit against the
project's design spec (`docs/design/ground-rules.md`, `docs/design/literal-reference-method.md`,
`docs/design/AGENT-INSTRUCTIONS.md`). This is the audit report; screenshots live under
`docs/e2e-screenshots/`.

## Method

- Seeded the local Docker stack (`./scripts/stack-up.sh --seed`) using the existing
  `apps/api/scripts/seed-e2e-screenshots.ts` fixtures — artist, member, free listener,
  fresh (no-channel) artist, and board admin accounts with realistic non-zero stats.
- Extended `scripts/capture-e2e-screenshots.mjs` from ~55 to **87 captured views**,
  closing coverage gaps: all `/dashboard/settings/*` sub-pages, collections, archive,
  upload, revenue, stats detail, releases catalog + detail, several admin pages
  (`grants`, `agm`, `radio`, `settings/vendors`, `tahti-selects`), and the legal/info
  pages (`about`, `agpl`, `privacy`, `terms`, `signup`, `venues/register`).
- Ran `tests/e2e/no-scroll.mjs`, the repo's existing mechanical implementation of
  ground-rules.md Rule 1, against all dashboard/admin/public routes at 1440×900.
- Ran the Rule 3/Rule 4 mechanical greps from `AGENT-INSTRUCTIONS.md` / `ground-rules.md`
  (raw hex values outside `tokens.css`, hand-typed `ui-btn`/`brand-btn` classNames).
- Spot-checked the actual screenshots for the routes the no-scroll check flagged, to
  identify root causes rather than just report a scrollHeight number.

Not done (out of scope for this pass, flagged for follow-up): a full pixel-diff of all
87 screenshots against the 16 `docs/reference-html/*.html` mockups, and a 375px mobile
pass. Given the size of that work (the ground-rules brief itself estimates 2–3 days for
just the no-scroll fixes), this audit prioritized getting accurate, reproducible
mechanical findings across the whole app over a deep manual diff of every route.

## Fixed as part of this pass

**The local stack could not boot at all before this work.** `infra/docker-compose.stack.yml`
defaulted `MINIO_SECRET_KEY` to the literal string `tahti_dev_secret` — which is the exact
sentinel value `apps/api/src/config.ts`'s production-secret guard (SEC-005) checks for, so
the API container refused to start under `NODE_ENV=production` (which this compose file
always sets). The other secrets in the same block already used `local-stack-*` placeholders
to dodge this; `MINIO_SECRET_KEY` was the one left unfixed. Changed the fallback default to
`local-stack-minio-secret` in the three places it's read (api, minio, minio-init). This is a
fallback-only value — `deploy_prod.sh` passes real secrets via `--env-file`, so production is
unaffected.

## Rule 1 (no scrolling) — mechanical results

42 passed, 5 failed, 5 exempt (per the existing allowed-exceptions list). Full output in
the PR; failures:

| Route | scrollHeight | Over by | Likely cause |
|---|---|---|---|
| `/dashboard/broadcast?step=1` | 1073 | 173px | Combines "credentials" and "test your signal" into one view. `docs/reference-html/03-broadcasting-step-1-credentials.html` and `04-broadcasting-step-2-test-signal.html` specify these as two separate steps/routes — this is a literal-reference-method Rule B violation (extra content not in the step-1 reference) as well as a Rule 1 failure. See `docs/e2e-screenshots/artist/broadcast-studio.png`. |
| `/dashboard/channel/edit` | 1271 | 371px | The "Visual" control column (brand-accent swatches → header-style radio → 2×3 background-visualizer card grid → "use custom color scheme" checkbox → 4 color-swatch pairs) stacks everything in one column with no internal scroll region. This is otherwise a strong, correct implementation of the channel-designer pattern (live preview left, controls right, no tabs) — the fix is compacting or internally-scrolling this one column, not a redesign. See `docs/e2e-screenshots/artist/channel-appearance.png`. |
| `/dashboard/channel/gallery` | 1197 | 297px | Not yet visually inspected this pass (not in the current capture list — worth adding). |
| `/dashboard/channel/text` | 1197 | 297px | Same as above — identical overflow to `channel/gallery` suggests a shared layout component is the common cause. |
| `/dashboard/settings/fan-subs` | 1040 | 140px | Partially conforms already (price slider + perk toggle chips are already direct-manipulation, not pure form fields). Overflow comes from stacking the subscriber/payout table, the two existing-tier rows, *and* the new-tier-creation form on one screen. The "hero" (the "2 active subscribers" stat card) is real but nowhere near the required ≥30% of viewport height — a partial Rule 3 finding alongside the Rule 1 failure. See `docs/e2e-screenshots/artist/settings-fan-subs.png`. |

## Rule 3 (not a tax form) — spot findings

- `/dashboard/settings/fan-subs`: see above — hero present but undersized; new-tier
  creation is a stack of label+input pairs (tier name, description, perks) that could
  adopt more direct manipulation (perk toggles already do this well; the text fields
  don't).
- Every other settings page captured (`account`, `artist-info`, `connections`,
  `distribution`, `domain`, `mentions`, `moderators`, `multistream`, `notifications`)
  passed the Rule 1 mechanical check — worth a follow-up visual pass against the
  ground-rules.md per-page treatment table, since fitting in 900px doesn't by itself
  prove the instrument pattern (hero, direct manipulation) was actually followed.

## Rule 4 (icon buttons) — mechanical grep

`grep -rn 'className="ui-btn\|className="brand-btn"' apps/web/src --include="*.tsx" | grep -v 'packages/ui/src'`
→ **72 hand-typed call sites.** This matches the already-documented, already-accepted
scope in `ground-rules.md` ("~60 existing hand-typed call sites... migrate
opportunistically when a file is touched for other reasons") — not a new regression,
still open, still the right call to leave alone rather than a mechanical drive-by rename.

## Token hygiene (raw hex values)

`grep -rn '#[0-9a-fA-F]{3,8}'` outside `tokens.css` → 54 hits, all in
`packages/ui/src/styles/brand-channel.css`, all explicitly annotated
`/* design-token-allow: platform brand color */` (Spotify green, SoundCloud orange,
Bandcamp blue, etc., for third-party platform badges/links). No unvetted drift found.

## Coverage gaps still open after this pass

Routes with no seed data making them reachable, so not yet captured or no-scroll-checked:
`/dashboard/moderate/[slug]` (needs a specific pending-moderation item), `/v/[slug]`
(no venue slug in the seed fixtures), `/admin/users/[id]` and `/admin/support/[id]`
(need a dynamic-ID lookup step the capture script doesn't do yet), `/dashboard/upload/[uploadId]`
and the `/dashboard/upload/import/*` sub-flows (need an in-progress upload). `/dev/components`
was intentionally excluded — it's dev tooling, not a real user-facing view.

## What this audit deliberately did not do

Fix any of the 5 no-scroll failures, or do the full 16-route literal-reference pixel diff.
Ground-rules.md's own estimate for the tax-form/no-scroll redesign pass is 2–3 days of
focused work — that's a real implementation project, not something to fold into an audit
pass silently. Flagging concretely here so it can be scoped as deliberate follow-up work.
