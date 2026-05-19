REGISTRY   ?= registry.tahti.fi
TAG        ?= $(shell git rev-parse --short HEAD)
STACK_NAME ?= tahti
COMPOSE    := docker compose -f infra/docker-compose.dev.yml

.PHONY: help dev dev-down build build-website push deploy rollback secrets-check logs

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Dev"
	@echo "  dev            Start all local infra (postgres, redis, minio, chat, website, mailhog)"
	@echo "  dev-website    Build and start only the website container"
	@echo "  dev-down       Stop and remove local infra containers"
	@echo ""
	@echo "Build"
	@echo "  build          Build all app images"
	@echo "  build-website  Build the marketing website image"
	@echo "  push           Push all images to $(REGISTRY)"
	@echo ""
	@echo "Production"
	@echo "  deploy         Deploy/update the stack on the Swarm  (TAG=<sha> required)"
	@echo "  rollback       Roll back every service one version"
	@echo "  secrets-check  List which Docker secrets are set on the Swarm"
	@echo "  logs           Tail logs for a service: make logs SVC=api"

# ── Dev ───────────────────────────────────────────────────────────────────────
dev:
	$(COMPOSE) up -d
	@echo "Website → http://localhost:8080"
	@echo "MailHog → http://localhost:8025"
	@echo "MinIO   → http://localhost:9001  (user: tahti / tahti_dev_secret)"

dev-website:
	$(COMPOSE) up -d --build website

dev-down:
	$(COMPOSE) down

# ── Build ─────────────────────────────────────────────────────────────────────
build: build-website build-api build-web build-worker build-orchestrator

build-website:
	docker build -t $(REGISTRY)/tahti/website:$(TAG) website/
	docker tag $(REGISTRY)/tahti/website:$(TAG) $(REGISTRY)/tahti/website:latest

build-api:
	docker build -t $(REGISTRY)/tahti/api:$(TAG) api/
	docker tag $(REGISTRY)/tahti/api:$(TAG) $(REGISTRY)/tahti/api:latest

build-web:
	docker build -t $(REGISTRY)/tahti/web:$(TAG) web/
	docker tag $(REGISTRY)/tahti/web:$(TAG) $(REGISTRY)/tahti/web:latest

build-worker:
	docker build -t $(REGISTRY)/tahti/worker:$(TAG) worker/
	docker tag $(REGISTRY)/tahti/worker:$(TAG) $(REGISTRY)/tahti/worker:latest

build-orchestrator:
	docker build -t $(REGISTRY)/tahti/orchestrator:$(TAG) orchestrator/
	docker tag $(REGISTRY)/tahti/orchestrator:$(TAG) $(REGISTRY)/tahti/orchestrator:latest

push:
	docker push $(REGISTRY)/tahti/website:$(TAG)
	docker push $(REGISTRY)/tahti/website:latest
	docker push $(REGISTRY)/tahti/api:$(TAG)
	docker push $(REGISTRY)/tahti/api:latest
	docker push $(REGISTRY)/tahti/web:$(TAG)
	docker push $(REGISTRY)/tahti/web:latest
	docker push $(REGISTRY)/tahti/worker:$(TAG)
	docker push $(REGISTRY)/tahti/worker:latest
	docker push $(REGISTRY)/tahti/orchestrator:$(TAG)
	docker push $(REGISTRY)/tahti/orchestrator:latest

# ── Production ────────────────────────────────────────────────────────────────
deploy:
	@test -n "$(TAG)" || (echo "TAG is required: make deploy TAG=<git-sha>"; exit 1)
	TAG=$(TAG) docker stack deploy \
		--with-registry-auth \
		--prune \
		-c infra/docker-stack.yml \
		$(STACK_NAME)

rollback:
	@for svc in website api web worker-media worker-dist worker-light chat orchestrator; do \
		docker service rollback $(STACK_NAME)_$$svc || true; \
	done

secrets-check:
	@echo "Docker secrets on this Swarm:"
	@docker secret ls

logs:
	@test -n "$(SVC)" || (echo "SVC is required: make logs SVC=api"; exit 1)
	docker service logs -f --tail=100 $(STACK_NAME)_$(SVC)
