# Branch protection (PLAT-002)

**2026-09-08: removed at the author's request.** `main` is unprotected —
direct pushes, force pushes, and branch deletion are all allowed
(`GET /repos/janiluuk/tahti-org/rules/branches/main` returns `[]`). The
**Main CI gate (PLAT-002)** ruleset (`22306827`, verified 2026-09-05, required
**All checks** + PR + resolved threads) was deleted, and the repo-wide
`default` ruleset now excludes `refs/heads/main` from its PR/no-force-push
rules while still applying to every other branch.

CI (`.github/workflows/ci.yml`) still runs on pushes to `main` and gates the
**Release images & changelog** job on **All checks** passing — only the
GitHub-side requirement to go through a reviewed PR before merging is gone.

GitHub branch protection cannot be committed to the repo; configure it in the repository settings for `main`.

## CI jobs (informational — no longer required by branch protection)

The **`All checks`** job in the [CI workflow](./workflows/ci.yml) still aggregates these:

| Job name                                    | Purpose                         |
| ------------------------------------------- | ------------------------------- |
| Validate website Docker build               | Marketing site image builds     |
| Lint & format                               | ESLint + Prettier               |
| Typecheck                                   | `tsc` across the monorepo       |
| Unit + integration tests                    | Vitest + Postgres               |
| API vital flows (curl e2e)                  | Core API smoke paths            |
| User journey e2e (listener, artist, member) | Guides-backed journeys          |
| AGPL header check                           | License headers on source files |

To restore the gate later: recreate a ruleset targeting `refs/heads/main`
with `pull_request` + `required_status_checks` (context `All checks`), and
drop `refs/heads/main` from the `default` ruleset's exclude list.

## Release gate

Pushes to `main` run the **Release images & changelog** job only after **All checks** succeeds. That job:

- Tags the release `YYYY-MM-DD-buildnr` (display name `YYYY-MM-DD #N`)
- Builds and pushes Docker images to `registry.tahti.live` with the release tag, commit SHA, and `latest`
- Publishes a GitHub release whose body includes generated changelog notes

The **deploy** workflow then rolls staging using the dated release tag (via `workflow_run` after CI).
