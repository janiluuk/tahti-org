# Remaining work — collective incomplete checklist

Single index of items still marked **open** (`[ ]`) or **partial** (`[~]`) across
the docs package. Status detail and owners live in the linked sources; update
those sources when closing work, then refresh this file.

**Last compiled:** 2026-08-25 (from `project-roadmap.md`, `future-improvements.md`).

---

## How to use

| Mark  | Meaning                                        |
| ----- | ---------------------------------------------- |
| `[ ]` | Not started / blocked on org or ops            |
| `[~]` | Partially done — remaining notes in source row |

Engineering agents: prefer **Dev / P0–P2** sections. Board/Director items are
listed for completeness but are not coding tasks.

---

## P0–P1 engineering (ship / beta blockers)

| ID / item                                                                                                              | Status  | Owner       | Source                           |
| ---------------------------------------------------------------------------------------------------------------------- | :-----: | ----------- | -------------------------------- |
| **STREAM-011 B** — live/24-7 multi-bitrate HLS (lossless or high-bitrate ABR); spike Liquidsoap fMP4 + master playlist |  `[ ]`  | Dev         | `project-roadmap.md` §STREAM-011 |
| **STREAM-011 A** — on-demand prefer FLAC                                                                               | ✅ done | —           | `archivePlaybackKey` + tests     |
| **PLAT-002** — require all `ci.yml` jobs in GitHub branch protection                                                   |  `[~]`  | Dev / admin | `.github/BRANCH_PROTECTION.md`   |
| **PLAT-053** — Tahti Radio → Mixcloud Live (blocked: radio `.liq` not in-repo)                                         |  `[~]`  | Dev         | roadmap PLAT-053                 |
| **M11** — live Upptime fork deploy                                                                                     |  `[~]`  | Ops         | roadmap M11                      |
| **M29** — pgBackRest PITR (interim `backup.sh` exists)                                                                 |  `[~]`  | Dev / Ops   | roadmap M29                      |
| MVP manual matrix: Mixxx/Icecast path, stop→archive, chat ban expiry, membership register→pay→export, load test        |  `[ ]`  | Dev         | roadmap Phase 3 test matrix      |
| **PLAT-010** — Turbo remote cache secrets in CI                                                                        |  `[~]`  | Dev         | `.github/TURBO_REMOTE_CACHE.md`  |
| **PLAT-012** — Vitest Testcontainers + parallel workers                                                                |  `[~]`  | Dev         | future-improvements              |
| Playwright smoke in CI against Docker stack (nightly)                                                                  |  `[x]`  | Dev         | future-improvements §Testing     |
| `user-journeys-e2e` required in branch protection                                                                      |  `[ ]`  | Dev         | future-improvements              |

---

## Partial milestones (code mostly shipped)

| Milestone | Remaining                                               | Status |
| --------- | ------------------------------------------------------- | :----: |
| **M7**    | Production Mixcloud OAuth credentials; royalty sync ops | `[~]`  |
| **M13**   | SES broadcast transport if SMTP limits hit              | `[~]`  |
| **M19**   | Royalty sync deferred; production Connect credentials   | `[~]`  |
| **M11**   | Upptime live deploy                                     | `[~]`  |
| **M29**   | pgBackRest + operator timed drill without director      | `[~]`  |

Ops-only go-lives (code ready): Revelator credentials (**PLAT-056**), Mixcloud prod OAuth (**PLAT-057**).

## Governance system hardening (product + records)

The governance portal currently supports advisory motions and discussion, but is
not yet the association's official decision record. These items must follow the
adopted bylaws and legal review.

| ID / item                                                                                              | Status | Owner       | Depends                 |
| ------------------------------------------------------------------------------------------------------ | :----: | ----------- | ----------------------- |
| Members can submit formal motion drafts for board review                                               | `[x]`  | Dev         | member auth             |
| Closed advisory-motion results are available through public history API                                | `[x]`  | Dev         | transparency API        |
| Persist meeting metadata, eligibility counts, quorum thresholds, and attendance snapshots              | `[x]`  | Dev         | meeting records         |
| Persist AGM and board meetings with agenda, notice, attendance, and quorum                             | `[x]`  | Dev         | meeting records         |
| Member-motion review, seconding, circulation deadline, and AGM scheduling                              | `[ ]`  | Dev / Board | meeting model           |
| Official voting rules: eligibility snapshot, quorum, majority, ballot method, result certificate       | `[ ]`  | Dev / Legal | bylaws                  |
| Signed minutes upload, approval, redaction, publication, and immutable history                         | `[ ]`  | Dev / Board | document model          |
| Organized association document repository for bylaws, policies, notices, reports, minutes, and filings | `[ ]`  | Dev / Board | document model          |
| Link published decisions to meetings, agenda items, motions, votes, and minutes                        | `[ ]`  | Dev         | official decision model |
| Member notices, reminders, delivery log, and deadline tracking                                         | `[ ]`  | Dev / Board | member communication    |
| Board roles, terms, election history, conflicts, recusals, and scoped permissions                      | `[ ]`  | Dev / Board | board records           |
| Privacy controls and historical membership eligibility records                                         | `[ ]`  | Dev / Legal | GDPR / bylaws           |
| Replace governance list N+1 requests with detail loading and cursor pagination                         | `[ ]`  | Dev         | API/UI refactor         |

Additional governance gaps from the audit:

- [ ] Persist official member eligibility periods and privacy-scoped register views.
- [x] Add AGM/board attendance and quorum data.
- [ ] Add AGM/board chair, secretary, and signed approval data.
- [ ] Add official ballot receipts, secret-ballot protection, recount, and correction procedure.
- [ ] Add member notices, reminders, delivery evidence, and circulation deadlines.
- [ ] Add permanent public archive pages for decisions, minutes, bylaws, and historical reports.
- [ ] Add legal association information: Business ID, registered details, contacts, auditor, and signatories.
- [ ] Add annual filing checklist and approval status for accounts, auditor report, and PRH submission.

## Plugin registry separation (non-breaking preparation)

The plugin registry must become a separately owned product boundary, but the
current implementation remains in place until the replacement contract is
proven. Do not move files, change storage keys, or alter plugin bootstrap order
as part of this preparation.

- [x] Inventory current registry responsibilities, persisted `plugins.json` format, and callers. → [`docs/todo/plugin-registry-extraction.md`](todo/plugin-registry-extraction.md)
- [x] Define a minimal registry interface and compatibility adapter around the current implementation. → [`docs/todo/plugin-registry-extraction.md` §5](todo/plugin-registry-extraction.md#5-minimal-compatibility-interface-and-adapter-plan)
- [ ] Add contract tests for install, enable/disable, warnings, update, and removal behavior.
- [ ] Define ownership between player core, plugin SDK, and import-provider plugins.
- [ ] Extract only after adapter tests and a migration/rollback plan are accepted.

---

## Platform backlog still open

| ID           | Item                                               | Status | P   |
| ------------ | -------------------------------------------------- | :----: | --- |
| **PLAT-081** | Cloud import abstraction (Dropbox/OneDrive/WebDAV) | `[ ]`  | P3  |
| **PLAT-082** | Google Drive import audit-log entry per job        | `[x]`  | P2  |
| **PLAT-053** | Radio Mixcloud Live (see above)                    | `[~]`  | P2  |

Most PLAT-001–080 / SEC / UX / PERF items are **done** — see roadmap tables.

---

## Phase 0 — Association (blocking money & DPAs)

All `[ ]` — Board / Treasurer / Director. Doc: `governance-and-legal.md`.

- Agree purpose, name Tahti ry, fiscal year
- Bylaws draft → Finnish legal review
- Founding meeting + PRH registration
- Bank account, interim board, director + maintenance roster
- VAT if needed; GDPR register + privacy; vendor DPAs

---

## Phase 1 — Grants & runway

All `[ ]` — Director / Treasurer. Doc: `funding-strategy.md`, `financial-model.md`.

- One-pager + foundation deck
- Tempo / Koneen / SKR applications
- Co-funding narrative; Plan B if &lt;€20k
- G1–G3 milestones (first app submitted → ≥€20k → Y2 pipeline)

---

## Phase 2 / 2b — Infra & backup (pre-public beta)

Open / partial highlights:

| Item                                                   | Status |
| ------------------------------------------------------ | :----: |
| Hardware, fiber, UpCloud, Swarm/staging, monitoring    | `[ ]`  |
| Domain DNS → Caddy edge                                | `[ ]`  |
| UpCloud backup buckets + MinIO `backups` alias         | `[ ]`  |
| pgBackRest + WAL                                       | `[ ]`  |
| Operator restore drill (script exists; timed exercise) | `[~]`  |
| UpCloud DPA before offsite PII                         | `[ ]`  |

---

## Phase 8–10 — Beta, handover, ongoing

Recruit anchors, office hours, press, AGM, first grant distribution — all `[ ]`
(Director/Board). Handover tracks (infra/support/treasurer), legal asset
transfer, governance rhythms, post-handover cadences — see roadmap Phases 8–10.

---

## Explicitly deferred (not incomplete “bugs”)

- STREAM-011 B spike may land as high-bitrate AAC/MP3 ABR, not true lossless HLS
- M30+: direct PRO filing, AllMusic pitch
- ACRCloud post-production annotation cron (gated by `ACRCLOUD_ENABLED`)
- Tahti Player web production cutover — follow `ops/nuclear-web-cutover.md`

---

## Testing coverage expectations

See **`docs/testing.md`**. Money, ingest, grants, downloads, and public abuse
reporting must have Vitest coverage; journey scripts cover persona paths.
When adding a public or authenticated route area, add a colocated `*.test.ts`
unless an existing admin/journey suite already covers the same HTTP contract.
