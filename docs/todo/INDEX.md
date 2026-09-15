# docs/todo — work index

Agents: read this file instead of skimming `docs/todo/`, `docs/`, or
`docs/technical/` for "what's next". This repo already has hygiene rules for
`docs/todo/` in `CLAUDE.md` and `.cursor/rules/todo-history.mdc` — this file
is the missing navigation layer on top of them: one place that points at
every open todo, every roadmap/planning doc, and every archived-and-why.

Status values: `open` | `blocked` | `partial`.

## Active todos (`docs/todo/*.md`)

One file per in-progress task. When a task ships, fold it into
[`HISTORY.md`](HISTORY.md) and delete the file — see the Fold rule below.

| Status  | File                                                           | One-line                                                                                                                                                                              |
| ------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| partial | [plugin-registry-extraction.md](plugin-registry-extraction.md) | Store adapter, `PluginRegistryHost`, contract tests, caller migration, and §6 test matrix all shipped in `../tahti-player`; ownership-split sign-off and final extraction remain open |
| open    | [tahti-local-onboarding.md](tahti-local-onboarding.md)          | New box tahti.local (192.168.2.107): plan to move MinIO there (LAN remote-service pattern, no GPU needed) + checklist to add it to all vimage6 monitoring dashboards                 |

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
| [`../worklogs/`](../worklogs/)                             | Session worklogs — kept only while a session still has open follow-ups                                                                                            | Empty right now (just its own `README.md`)                                                                                                    |

## Cross-repo pointers

- [`../../ops/nuclear-web-cutover.md`](../../ops/nuclear-web-cutover.md) points at `../tahti-player` — no real plan content lives on this side.
- `plugin-registry-extraction.md`'s remaining open item (ownership-split sign-off) is tracked solely here — `../tahti-player`'s `HISTORY.md` (2026-09-11) explicitly says so; its own `WORKPLAN.md` no longer carries a "Plugin registry extraction" section.

## Archived (historical, superseded — do not treat as current status)

[`../archive/`](../archive/) — `delivery-phases.md` + `phase-1.md`…`phase-12.md`,
moved here 2026-09-08. Each already self-labeled "historical planning spec,
written prospectively, superseded by `project-roadmap.md`'s milestone
matrix" — they were still sitting in `docs/` and `docs/technical/` (active
doc territory) despite saying so. Kept for original implementation recipes,
plus `delivery-phases.md`'s still-useful Scaling reference / Rollback
procedure sections. See [`../archive/README.md`](../archive/README.md).

Also folded into `HISTORY.md` this pass: three `docs/todo/*.md` files whose
branches had already merged to `main` weeks ago but were never deleted
(`stream-overlay-scrim-toggle.md`, `stream-overlay-show-title-toggle.md`,
`recurrence-duration-overlap.md`), plus one confirmed done on both sides of
the cross-repo split (`pwyw-track-purchase-frontend.md`), and the mail-stats
and migration-squash tasks folded on 2026-09-11 — see `HISTORY.md` for what
shipped in each.

Folded again on 2026-09-15: `redis-memory-cleanup.md` (#520),
`cron-runner-service.md` (#515), and `branding-nameplate.md` (#522) were all
still marked "open ... not yet pushed/PR'd" but had already merged to `main`
— their worktrees (`.claude/worktrees/branding-nameplate`,
`.claude/worktrees/channel-now-playing-endpoints`) were removed too. Also
`profile-branding-followups.md` (#523, own task this same pass) and
`mobile-player-nav-and-tahti-theme-visuals.md` (pointer-only — shipped in
`../tahti-player` on 2026-09-10, never deleted here after).

## Fold rule (copy into CLAUDE / chat)

```
Done task → append a compact dated section to docs/todo/HISTORY.md → delete docs/todo/<file>.md
         → move real leftovers into docs/remaining-work.md or a new slim todo
Never leave a shipped file sitting in docs/todo/. This repo's own CLAUDE.md
and .cursor/rules/todo-history.mdc already say so — this INDEX just makes it
visible fast when that rule gets skipped (it did, 4 times, before this pass).
```
