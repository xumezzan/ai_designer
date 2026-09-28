# Invito AI — developer shortcuts
.PHONY: setup api web dev

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
