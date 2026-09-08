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

| Status  | File                                                                                         | One-line                                                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| open    | [mobile-player-nav-and-tahti-theme-visuals.md](mobile-player-nav-and-tahti-theme-visuals.md) | Pointer only — real plan lives in `../tahti-player/docs/todo/` (same filename there)                                                                                                                               |
| partial | [plugin-registry-extraction.md](plugin-registry-extraction.md)                               | §5.1/§5.2 store adapter + §5 `PluginRegistryHost` façade both shipped in `../tahti-player` (additive, non-breaking), §6 contract tests cover both; caller migration (§5.4) and ownership-split sign-off still open |

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

- [`mobile-player-nav-and-tahti-theme-visuals.md`](mobile-player-nav-and-tahti-theme-visuals.md) and [`../../ops/nuclear-web-cutover.md`](../../ops/nuclear-web-cutover.md) both just point at `../tahti-player` — no real plan content lives on this side.
- `plugin-registry-extraction.md`'s counterpart status lives in `../tahti-player`'s `packages/tahti-web/WORKPLAN.md` under "Plugin registry extraction (partial)".

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
the cross-repo split (`pwyw-track-purchase-frontend.md`) — see `HISTORY.md`
for what shipped in each.

## Fold rule (copy into CLAUDE / chat)

```
Done task → append a compact dated section to docs/todo/HISTORY.md → delete docs/todo/<file>.md
         → move real leftovers into docs/remaining-work.md or a new slim todo
Never leave a shipped file sitting in docs/todo/. This repo's own CLAUDE.md
and .cursor/rules/todo-history.mdc already say so — this INDEX just makes it
visible fast when that rule gets skipped (it did, 4 times, before this pass).
```
