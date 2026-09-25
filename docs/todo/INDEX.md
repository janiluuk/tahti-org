# docs/todo — work index

Agents: read this file instead of skimming `docs/todo/`, `docs/`, or
`docs/technical/` for "what's next". This repo already has hygiene rules for
`docs/todo/` in `CLAUDE.md` and `.cursor/rules/todo-history.mdc` — this file
is the missing navigation layer on top of them: one place that points at
every open todo, every roadmap/planning doc, and every archived-and-why.

Status values: `open` | `blocked` | `partial`.

## Active todos (`docs/todo/*.md`)

One file per in-progress task. When a task ships, fold it into
[`HISTORY.md`](HISTORY.md) and delete the file — see `CLAUDE.md`.

| Status  | File                                                                                   | One-line                                                                                                                                                                |
| ------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| partial | [api-redis-stall-resilience.md](api-redis-stall-resilience.md)                         | Redis command timeout + short bypass after a timeout so a stalled Redis can't hold API requests; latency and disk alerts. Left: deploy, and move Redis off vimage's HDD |
| open    | [tahti-local-onboarding.md](tahti-local-onboarding.md)                                 | New box tahti.local (192.168.2.107): move MinIO there (LAN remote-service pattern) + add it to the vimage6 monitoring dashboards                                        |
| open    | [internet-radio-now-playing-yle-nelonen.md](internet-radio-now-playing-yle-nelonen.md) | 2 of 6 stations shipped; Yle needs an app-key, Nelonen Media needs its now-playing API found via browser network inspection                                             |

## Roadmap & planning (broader than a single task)

These aren't per-task todos — they're the standing status/decision docs this
repo already uses. `docs/AGENT.md` names them as canonical; this table adds
the "is it actually fresh" read before you trust one blindly.

| Doc                                                        | What it's for                                                                                                                                                     | Freshness                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [`../project-roadmap.md`](../project-roadmap.md)           | Master milestone matrix (M0–M21) + handover checklist — the single source of truth for build status                                                               | Header says "updated 2026-06-05"; cross-check against `remaining-work.md` (2026-09-05) and this INDEX before quoting an exact milestone state |
| [`../remaining-work.md`](../remaining-work.md)             | Consolidated `[ ]`/`[~]` checklist compiled from `project-roadmap.md` + `future-improvements.md` + archived session leftovers                                     | Last compiled 2026-09-05                                                                                                                      |
| [`../planning-decisions.md`](../planning-decisions.md)     | Every unresolved architectural/legal/product decision blocking a milestone — work through in order, early decisions unblock later ones                            | Not date-stamped; skim the `OPEN` rows                                                                                                        |
| [`../future-improvements.md`](../future-improvements.md)   | Deferred-from-roadmap work + engineering efficiency backlog                                                                                                       | "Last reviewed: 2026-06-05" — 3 months stale as of this pass, re-verify before acting on any single line                                      |
| [`../cloud-import-roadmap.md`](../cloud-import-roadmap.md) | Scoped: cloud-drive import beyond the shipped Google Drive phase 1                                                                                                | Small, self-contained, not part of the milestone matrix                                                                                       |
| [`../governance-worklog.md`](../governance-worklog.md)     | Open-items-only governance checklist (member journey / board ops / technical integrity / plugin-registry boundary) — already follows the "open only" hygiene rule | Current                                                                                                                                       |
| [`../worklogs/`](../worklogs/)                             | Session worklogs — kept only while a session still has open follow-ups                                                                                            | One open: STREAM-011 HLS spike (true-lossless fMP4)                                                                                           |

## Cross-repo pointers

- [`../../ops/nuclear-web-cutover.md`](../../ops/nuclear-web-cutover.md) (Tahti Player web cutover) points at `../tahti-player` — no real plan content lives on this side.

## Archived (historical, superseded — do not treat as current status)

[`../archive/`](../archive/) — `delivery-phases.md` + `phase-1.md`…`phase-12.md`,
moved here 2026-09-08. Each already self-labeled "historical planning spec,
written prospectively, superseded by `project-roadmap.md`'s milestone
matrix" — they were still sitting in `docs/` and `docs/technical/` (active
doc territory) despite saying so. Kept for original implementation recipes,
plus `delivery-phases.md`'s still-useful Scaling reference / Rollback
procedure sections. See [`../archive/README.md`](../archive/README.md).

## Fold rule (copy into CLAUDE / chat)

```
Done task → append a compact dated section to docs/todo/HISTORY.md → delete docs/todo/<file>.md
         → move real leftovers into docs/remaining-work.md or a new slim todo
Never leave a shipped file sitting in docs/todo/. This repo's own CLAUDE.md
and .cursor/rules/todo-history.mdc already say so — this INDEX just makes it
visible fast when that rule gets skipped (it did, 4 times, before this pass).
```
