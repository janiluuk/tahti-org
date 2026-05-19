# Phase 5 — Staging cluster

**Goal:** a structurally identical copy of production (3-node Swarm) auto-deploys on every push to `main`. Production only deploys on a tagged release. Both environments use real data structures, different data.

**Timeline:** Month 3–4 (parallel with Phase 4 app work)  
**Entry state:** Phase 2 CI working, Phase 3 secrets management understood.

---

## Multi-node Swarm topology

```mermaid
graph TB
    subgraph Swarm ["Docker Swarm cluster"]
        direction TB

        subgraph Manager ["Manager node\n2 vCPU / 4 GB"]
            MGR[swarm manager\norchestrator service]
        end

        subgraph Worker1 ["Worker node 1\n4 vCPU / 8 GB"]
            W1A[api replica 1]
            W1B[web replica 1]
            W1C[website replica 1]
            W1D[worker-media replica 1]
            W1E[chat replica 1]
        end

        subgraph Worker2 ["Worker node 2\n4 vCPU / 8 GB"]
            W2A[api replica 2]
            W2B[web replica 2]
            W2C[website replica 2]
            W2D[worker-media replica 2]
            W2E[chat replica 2]
        end

        subgraph DB_node ["DB node\n4 vCPU / 16 GB"]
            DB1[(postgres)]
            DB2[(redis)]
            DB3[prometheus]
            DB4[grafana]
        end

        subgraph Storage_node ["Storage node\n2 vCPU / 4 GB + NVMe"]
            ST1[(minio)]
        end

        subgraph Edge_node ["Edge node\n2 vCPU / 2 GB"]
            ED1[caddy\nTLS termination]
        end

        subgraph Ingest_node ["Ingest node\n2 vCPU / 4 GB"]
            IN1[nginx-rtmp\n:1935]
            IN2[icecast\n:8000]
        end
    end

    Internet -- HTTPS 443 --> ED1
    Internet -- RTMP 1935 --> IN1
    Internet -- Icecast 8000 --> IN2
```

## Deploy pipeline — staging vs production

```mermaid
flowchart TD
    Push[git push main] --> CI[GitHub Actions]

    CI --> BuildAll["Build all images\napi, web, website,\nworker, orchestrator"]

    BuildAll --> PushRegistry[Push to registry.tahti.fi\nwith :sha tag]

    PushRegistry --> DeployStaging["Deploy to staging\nstaging.tahti.fi\nautomatic on every push"]

    DeployStaging --> SmokeStaging{Smoke tests\npass?}

    SmokeStaging -- "No → alert" --> Fail[Fail + notify Slack/email]
    SmokeStaging -- Yes --> TagRelease{Tagged\nrelease?}

    TagRelease -- "No (regular push)" --> Done1[Done — staging only]
    TagRelease -- "Yes (v*.*.*)" --> Approval{Manual approval\nin GitHub UI}

    Approval -- Approved --> DeployProd["Deploy to production\ntahti.fi"]
    DeployProd --> SmokeProd{Smoke tests\npass?}
    SmokeProd -- No --> Rollback[make rollback\nalert ops]
    SmokeProd -- Yes --> Done2[Done ✓]
```

## Service update sequence (rolling deploy)

```mermaid
sequenceDiagram
    participant CI as GitHub Actions
    participant Reg as registry.tahti.fi
    participant MGR as Swarm manager
    participant W1 as Worker node 1
    participant W2 as Worker node 2

    CI->>Reg: push tahti/api:abc123
    CI->>MGR: SSH: docker service update --image tahti/api:abc123 tahti_api

    Note over MGR,W2: update_config: parallelism=1, order=start-first

    MGR->>W1: Start api replica with new image
    W1->>Reg: docker pull tahti/api:abc123
    W1-->>MGR: new replica healthy (healthcheck passes)
    MGR->>W1: Stop old api replica on W1

    MGR->>W2: Start api replica with new image
    W2->>Reg: docker pull tahti/api:abc123
    W2-->>MGR: new replica healthy
    MGR->>W2: Stop old api replica on W2

    Note over MGR: deploy complete — zero downtime
    MGR-->>CI: exit 0
```

## Node provisioning

### Manager node

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Init Swarm (save join token)
docker swarm init --advertise-addr <manager-private-ip>

# Get tokens for other nodes
docker swarm join-token worker   # → copy for worker nodes
docker swarm join-token manager  # → copy if adding manager replicas

# Label manager
docker node update --label-add role=worker $( docker info -f '{{.Swarm.NodeID}}' )
```

### Worker nodes (repeat for each)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Join Swarm (paste the join command from manager)
docker swarm join --token <SWMTKN-...> <manager-ip>:2377

# Back on manager — label the new node
docker node ls  # get node ID
docker node update --label-add role=worker <node-id>
```

### Specialised nodes

```bash
# DB node
docker node update --label-add role=db <db-node-id>

# Storage node
docker node update --label-add role=storage <storage-node-id>

# Edge node
docker node update --label-add role=edge <edge-node-id>

# Ingest node
docker node update --label-add role=ingest <ingest-node-id>
```

## Staging environment config

Staging uses a separate `infra/docker-stack.staging.yml` that overrides:
- Fewer replicas (1 each instead of 2-3)
- Staging domain (`staging.tahti.fi`)
- Separate Swarm secrets (real keys but throw-away data)

```bash
# On staging manager
TAG=<sha> docker stack deploy \
  -c infra/docker-stack.yml \
  -c infra/docker-stack.staging.yml \
  tahti-staging
```

`infra/docker-stack.staging.yml` (override file):
```yaml
version: "3.9"
services:
  api:
    deploy:
      replicas: 1
  web:
    deploy:
      replicas: 1
    environment:
      NEXT_PUBLIC_API_BASE: https://api.staging.tahti.fi
      NEXT_PUBLIC_CHAT_BASE: https://chat.staging.tahti.fi
  website:
    deploy:
      replicas: 1
  chat:
    deploy:
      replicas: 1
  worker-media:
    deploy:
      replicas: 1
```

## CI pipeline additions

```yaml
# .github/workflows/deploy.yml

name: deploy

on:
  push:
    branches: [main]
  push:
    tags: ['v*.*.*']

jobs:
  build:
    runs-on: ubuntu-24.04
    outputs:
      tag: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - name: Build all images
        run: |
          make build TAG=${{ github.sha }}
      - name: Push to registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" |
            docker login registry.tahti.fi -u tahti --password-stdin
          make push TAG=${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-24.04
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: root
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /srv/tahti
            TAG=${{ github.sha }} docker stack deploy \
              -c infra/docker-stack.yml \
              -c infra/docker-stack.staging.yml \
              tahti-staging
      - name: Smoke test staging
        run: |
          sleep 30
          curl -f https://staging.tahti.fi/health
          curl -f https://api.staging.tahti.fi/health

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-24.04
    if: startsWith(github.ref, 'refs/tags/v')
    environment: production   # requires manual approval in GitHub UI
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: root
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd /srv/tahti
            TAG=${{ github.sha }} make deploy
      - name: Smoke test production
        run: |
          sleep 30
          curl -f https://tahti.fi/health
          curl -f https://api.tahti.fi/health
      - name: Rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: root
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: cd /srv/tahti && make rollback
```

## Exit criteria

| Check | Method | Expected |
|-------|--------|----------|
| 3-node Swarm healthy | `docker node ls` on manager | All nodes `Ready Active` |
| Services spread across nodes | `docker stack ps tahti` | api/web on Worker1+2 |
| Push deploys staging | Push a commit | staging.tahti.fi updated < 5 min |
| Tag deploys production | Create `git tag v0.1.0 && git push --tags` | Requires approval, then deploys |
| Rollback works | `make rollback` | All services step back to previous image |
| No data cross-contamination | Query staging DB | Only staging test artists visible |
