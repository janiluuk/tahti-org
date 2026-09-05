# Branch protection (PLAT-002)

GitHub branch protection cannot be committed to the repo; configure it in the repository settings for `main`.

## Required status checks

Require the **`All checks`** job from the [CI workflow](./workflows/ci.yml) before merge. That job fails if any of these jobs fail:

| Job name | Purpose |
|----------|---------|
| Validate website Docker build | Marketing site image builds |
| Lint & format | ESLint + Prettier |
| Typecheck | `tsc` across the monorepo |
| Unit + integration tests | Vitest + Postgres |
| API vital flows (curl e2e) | Core API smoke paths |
| User journey e2e (listener, artist, member) | Guides-backed journeys |
| AGPL header check | License headers on source files |

Optional but recommended: also require **Generate OpenAPI spec** if you want OpenAPI artifacts on every merge.

## Settings checklist

Configured as ruleset **Main CI gate (PLAT-002)** on `main` (not classic branch protection).

1. **Require a pull request before merging** — still required; pushes to `main` are blocked.
2. **Required approving reviews: 0** — GitHub does not allow authors to approve their own PRs. This repo is a solo-maintainer project, so reviews are optional; the author can merge after CI.
3. **Require status checks to pass** → select **All checks**, and require the branch to be up to date.
4. **Do not allow bypassing** the CI/PR gate (no ruleset bypass actors).

Do not set required reviews to 1 unless a second person with write access is actually reviewing.

## Release gate

Pushes to `main` run the **Release images & changelog** job only after **All checks** succeeds. That job:

- Tags the release `YYYY-MM-DD-buildnr` (display name `YYYY-MM-DD #N`)
- Builds and pushes Docker images to `registry.tahti.live` with the release tag, commit SHA, and `latest`
- Publishes a GitHub release whose body includes generated changelog notes

The **deploy** workflow then rolls staging using the dated release tag (via `workflow_run` after CI).
