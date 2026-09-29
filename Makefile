# Invito AI — developer shortcuts
.PHONY: setup api web dev test migrate revision

setup:            ## install both apps
	python3 -m venv .venv && .venv/bin/pip install -r apps/api/requirements.txt
	cd apps/web && npm install
	cp -n apps/api/.env.example apps/api/.env || true

api:              ## run FastAPI (SQLite, inline jobs, local storage)
	cd apps/api && ../../.venv/bin/uvicorn app.main:app --reload --port 8000

web:              ## run Next.js
	cd apps/web && npm run dev

dev:              ## run both
	$(MAKE) -j2 api web

test:             ## run API tests + web type-check/lint/unit (same as CI)
	cd apps/api && python -m pytest -q tests
	cd apps/web && npx tsc --noEmit -p . && npx eslint src && npx vitest run

migrate:          ## apply DB migrations (alembic upgrade head)
	cd apps/api && ../../.venv/bin/alembic upgrade head

revision:         ## autogenerate a new migration (uses DATABASE_URL from .env)
	cd apps/api && ../../.venv/bin/alembic revision --autogenerate -m "$(m)"
