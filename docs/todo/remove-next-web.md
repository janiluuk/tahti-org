# Remove the legacy Next.js web app (`apps/web`)

**Status:** partial

Every public host has served the tahti-player SPA (`packages/tahti-web`,
container `tahti-beta-web` on vimage:15180) since the 2026-10-21 proxy flip, so
`apps/web` had no traffic. This PR deletes it and everything only it used.

## Done in the PR

- Deleted `apps/web` and `scripts/copy-ffmpeg-core.mjs`; lockfile pruned.
- CI/deploy: no `tahti/web` image build (ci.yml release, deploy.yml), no
  `web` build or `:17777` health check in `deploy-production.yml` /
  `scripts/deploy_prod.sh`.
- Compose `web` service gone (`docker-compose.stack.yml`, Swarm stacks, local
  override example); `app.` / `<slug>.` / custom-domain Caddy blocks removed.
- turbo, vitest workspace, Makefile, Dockerfiles, `.gitignore`, token check
  script, stack-up / stack-smoke scripts updated.
- Agent docs and rules point at tahti-player for UI.

## Left

- After merge: confirm the production deploy removed `tahti-stack-web-1` on
  vimage (`up -d --remove-orphans`); if not, stop and remove it by hand.
- Delete this file and its INDEX row once the above is confirmed.
- Longer leftovers are in `docs/remaining-work.md` (Next-era browser tests,
  retiring `@tahti/ui`, dormant Swarm/Caddy path).
