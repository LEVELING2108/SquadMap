# Common tasks. Run "make help" for the list.

COMPOSE := docker compose -f infra/docker-compose.dev.yml

ifeq ($(OS),Windows_NT)
MVNW := mvnw.cmd
else
MVNW := ./mvnw
endif

.DEFAULT_GOAL := help
.PHONY: help up down reset ps backend frontend install test test-backend test-frontend e2e lint

help:
	@echo "make up             start Postgres, Redis and Mailpit and wait until healthy"
	@echo "make down           stop them (data is kept)"
	@echo "make reset          stop them and delete the local database"
	@echo "make ps             show their status"
	@echo "make backend        run the API on http://localhost:8480"
	@echo "make frontend       run the web app on http://localhost:5480"
	@echo "make install        install frontend dependencies"
	@echo "make test           run backend and frontend tests"
	@echo "make e2e            run the browser tests"
	@echo "make lint           lint and type-check the frontend"

up:
	$(COMPOSE) up -d --wait

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down --volumes

ps:
	$(COMPOSE) ps

backend:
	cd backend && $(MVNW) spring-boot:run -Dspring-boot.run.profiles=local

frontend:
	cd frontend && npm run dev

install:
	cd frontend && npm ci

test: test-backend test-frontend

test-backend:
	cd backend && $(MVNW) -B -ntp verify

test-frontend:
	cd frontend && npm test

e2e:
	cd frontend && npm run e2e

lint:
	cd frontend && npm run lint && npm run typecheck
