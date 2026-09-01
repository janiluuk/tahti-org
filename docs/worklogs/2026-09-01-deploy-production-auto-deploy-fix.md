# Fix "Deploy production" auto-deploy — 2026-09-01

## Problem

`.github/workflows/deploy-production.yml` showed green on every push to `main`,
but its `deploy` job always skipped: the `DEPLOY_SSH_PRIVATE_KEY` repository
secret was never set, so `preflight` short-circuited with
`ready=false`. The only thing that ever actually shipped `apps/api`,
`apps/web`, `apps/worker`, and the orchestrator to vimage was running
`scripts/deploy_prod.sh` by hand.

## What was found while fixing it

Simply adding the missing secret would not have been safe. The workflow's
`deploy` step ran `scripts/lab-stack-up.sh`, and the sibling
`.github/workflows/deploy-lab-stack.yml` ran `scripts/remote-stack-deploy.sh`
→ `scripts/stack-up.sh` — both targeting the exact same `DEPLOY_HOST`
(`192.168.2.100`) and `DEPLOY_PATH` (`/srv/tahti`) as the real production
stack (`tahti-stack-*` containers, `infra/docker-compose.stack.yml`).

`scripts/stack-up.sh` is a local-dev convenience script: it runs
`docker compose -f infra/docker-compose.stack.yml build/up` with **no
`--env-file infra/stack.env`**, and its one-off seed step hardcodes
`postgresql://tahti:tahti_dev@postgres:5432/tahti`. Pointed at the live
`/srv/tahti` checkout, it would have rebuilt the running production
containers using dev-default secrets instead of the real
`POSTGRES_PASSWORD`, `SMTP_*`, and `RTMP_KEY_ENC_KEY` values in
`infra/stack.env` — i.e. arming the secret would have set up the exact
class of incident already seen twice on this host (the 2026-08-13 Postgres
volume wipe, and the stale `db-push` image data loss). It would also fire
automatically on every future push once the key existed.

## Fix

- Rewrote `deploy-production.yml`'s `deploy` job to call
  `scripts/deploy_prod.sh` — the script already trusted for manual
  deploys — via the same jumphost (`pi@sparkki.dudeisland.eu:4322` →
  `root@192.168.2.100`) SSH setup the workflow already had. It builds with
  `--env-file infra/stack.env` and only ever does `up -d --remove-orphans`
  (no `down`), so named volumes (postgres/minio/redis) survive each deploy.
- Deleted `deploy-lab-stack.yml`, `scripts/remote-stack-deploy.sh`, and
  `scripts/lab-stack-up.sh` — dead/dangerous once `deploy-production.yml`
  does the real deploy; nothing else referenced them.
- Updated the stale `deploy-lab-stack.yml` pointer in `ops/RUNBOOK.md` and
  noted that `deploy.yml`'s tag-triggered Swarm pipeline
  (`STAGING_HOST`/`PROD_HOST`, `registry.tahti.live` images) targets
  infrastructure that isn't actually deployed — it stays in the repo but
  has no secrets configured, so it can't fire.
- Generated a dedicated `ed25519` deploy keypair, installed the public key
  in `authorized_keys` on both the jumphost and vimage, verified the full
  two-hop SSH path manually, then stored the private key as the
  `DEPLOY_SSH_PRIVATE_KEY` repo secret and shredded the local copy.

## Result

Push to `main` → CI green → `Deploy production` now actually runs
`scripts/deploy_prod.sh` against vimage and hard-fails the job on a bad
health check (previous manual-script health loop didn't fail the process
on timeout; the workflow's separate `curl -fsS` step does).
