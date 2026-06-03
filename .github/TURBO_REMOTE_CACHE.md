# Turbo remote cache (PLAT-010)

CI passes `TURBO_TOKEN` and `TURBO_TEAM` into lint/typecheck jobs when configured in the repo.

1. Create a [Vercel Remote Cache](https://vercel.com/docs/monorepos/remote-caching) token for the team.
2. Add repository secret **`TURBO_TOKEN`**.
3. Add repository variable **`TURBO_TEAM`** (team slug).

Without these, Turbo uses local caching only (no change to CI behaviour).
