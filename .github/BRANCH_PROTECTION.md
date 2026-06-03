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

1. **Settings → Branches → Add rule** for `main`
2. **Require a pull request before merging** (1 approval for production)
3. **Require status checks to pass** → select **All checks**
4. **Require branches to be up to date** before merging
5. **Do not allow bypassing the above settings** (except org admins if needed)

## Release gate

Pushes to `main` run the **Release (YYYY-MM-DD-buildnr)** job only after **All checks** succeeds, so tagged releases never skip the same bar as PRs.
