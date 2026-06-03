# Phase 2 — Dev environment

**Goal:** any developer can clone the repo, run `make dev`, and have all infrastructure services running locally within 2 minutes. CI builds the website image and pushes it on every merge to `main`.

**Timeline:** Week 2–4  
**Entry state:** Phase 1 complete, tahti.live is live.  
**New services (local only):** postgres, redis, minio, chat, icecast, rtmp-ingest, mailhog.

---

## Local dev architecture

```mermaid
graph TB
    subgraph Developer machine
        direction TB
        subgraph "make dev → docker compose"
            Website[website\n:8080]
            PG[(postgres\n:5432)]
            RD[(redis\n:6379)]
            MN[(minio\n:9000 / :9001)]
            CH[centrifugo\n:8000]
            IC[icecast\n:8100]
            RTMP[nginx-rtmp\n:1935]
            MH[mailhog\n:1025 smtp\n:8025 ui]
        end

        subgraph "host processes (pnpm dev)"
            API[api\n:3000]
            WebApp[web\n:3001]
            Worker[workers]
        end

        API -- localhost:5432 --> PG
        API -- localhost:6379 --> RD
        API -- localhost:9000 --> MN
        API -- localhost:8000 --> CH
        WebApp -- localhost:3000 --> API
        Worker -- localhost:5432 --> PG
        Worker -- localhost:6379 --> RD
    end
```

## CI pipeline architecture

```mermaid
graph LR
    subgraph GitHub
        Push[git push main] --> GH[GitHub Actions]
    end

    subgraph "CI job: website"
        GH --> Build[docker build\nwebsite/]
        Build --> Push2[docker push\nregistry.tahti.live\ntahti/website:sha]
        Push2 --> Deploy[SSH → make deploy\nTAG=sha]
    end

    subgraph "Production VPS"
        Deploy --> Pull[docker pull]
        Pull --> Update[docker service update\nor compose up]
    end
```

## Developer onboarding sequence

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Shell as Terminal
    participant DC as docker compose
    participant API as API process

    Dev->>Shell: git clone repo && cd tba-platform
    Dev->>Shell: cp api/.env.dev.example api/.env
    Dev->>Shell: make dev
    Shell->>DC: docker compose -f infra/docker-compose.dev.yml up -d
    DC-->>Shell: postgres, redis, minio, chat, mailhog started
    Dev->>Shell: cd api && pnpm install && pnpm dev
    Shell->>API: starts on :3000
    API-->>Shell: "Server listening at http://localhost:3000"
    Dev->>Shell: open http://localhost:8080
    Note over Dev: marketing site loaded
    Dev->>Shell: open http://localhost:8025
    Note over Dev: MailHog email catcher loaded
```

## Runbook

### Prerequisites

```bash
# Required on developer machine
docker --version    # >= 24.0
docker compose version  # >= 2.20
make --version
node --version      # >= 24 LTS
pnpm --version      # >= 9
```

### First-time setup

```bash
git clone git@github.com:tahti-ry/tba-platform.git
cd tba-platform

# Copy env templates
cp api/.env.dev.example api/.env
cp web/.env.dev.example web/.env.local

# Start containerised infra
make dev

# Install app dependencies
cd api && pnpm install
cd ../web && pnpm install

# Run DB migrations
cd ../api && pnpm db:migrate

# Start API and web app
cd api && pnpm dev &
cd web && pnpm dev
```

### Service URLs (local)

| Service | URL | Credentials |
|---------|-----|-------------|
| Marketing site | http://localhost:8080 | — |
| API | http://localhost:3000 | — |
| Web app | http://localhost:3001 | sign up on the page |
| MinIO console | http://localhost:9001 | tahti / tahti_dev_secret |
| MailHog | http://localhost:8025 | — |
| Centrifugo admin | http://localhost:8000/admin | password: dev |
| Icecast | http://localhost:8100 | admin / dev_admin |

### Tear down

```bash
make dev-down   # stops and removes containers, preserves volumes
# To also delete volumes:
docker compose -f infra/docker-compose.dev.yml down -v
```

## CI setup (GitHub Actions)

### Required repository secrets

| Secret | Value | Where set |
|--------|-------|-----------|
| `REGISTRY_PASSWORD` | Docker registry password | GitHub → Settings → Secrets |
| `DEPLOY_SSH_KEY` | Private key for deploy user on VPS | GitHub → Settings → Secrets |
| `DEPLOY_HOST` | `192.168.2.100` or `tahti.live` | — |

### Website CI (`.github/workflows/website.yml`)

```yaml
name: website

on:
  push:
    branches: [main]
    paths: ["website/**", "docker-compose.yml"]

env:
  REGISTRY: registry.tahti.live
  IMAGE: tahti/website

jobs:
  build-deploy:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4

      - name: Log in to registry
        run: echo "${{ secrets.REGISTRY_PASSWORD }}" |
          docker login ${{ env.REGISTRY }} -u tahti --password-stdin

      - name: Build and push
        run: |
          docker build \
            -t ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ github.sha }} \
            -t ${{ env.REGISTRY }}/${{ env.IMAGE }}:latest \
            website/
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE }}:${{ github.sha }}
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE }}:latest

      - name: Deploy to production
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: root
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /srv/tahti
            TAG=${{ github.sha }} docker compose pull website
            TAG=${{ github.sha }} docker compose up -d --no-build website
```

## Port conflict reference

If any `make dev` service port conflicts with another local process:

```bash
# Check what's on a port
lsof -i :5432

# Override in docker compose by setting env var
POSTGRES_PORT=5434 docker compose -f infra/docker-compose.dev.yml up -d postgres
```

Or edit the port in `infra/docker-compose.dev.yml` locally (do not commit).

## Exit criteria

| Check | Command | Expected |
|-------|---------|----------|
| All containers up | `docker compose -f infra/docker-compose.dev.yml ps` | All `Up (healthy)` |
| Website local | `curl -s http://localhost:8080/health` | `ok` |
| Postgres accessible | `psql postgres://tahti:tahti_dev@localhost:5432/tahti -c '\l'` | Lists databases |
| Redis accessible | `redis-cli -p 6379 ping` | `PONG` |
| MinIO accessible | `curl -s http://localhost:9000/minio/health/live` | `200` |
| CI green | Push a whitespace change to `website/index.html` | Workflow passes in < 3 min |
| Registry push works | `docker pull registry.tahti.live/tahti/website:latest` | Pulls successfully |
