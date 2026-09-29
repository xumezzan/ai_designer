# Invito AI

**Beautiful event websites, designed with AI.**

Invito combines an inspiration board (Pinterest), an AI art director, an AI web
designer, a visual editor (Tilda / Framer-like) and an AI chat editor into one
product: describe your event, show a few references, get three professionally
designed, fully editable websites — then publish with a URL and QR code and
collect RSVPs.

```
apps/
  web/   Next.js 15 · React 19 · TypeScript · Tailwind — app, editor, renderer, public sites
  api/   FastAPI · SQLAlchemy · Pydantic — auth, projects, AI design engine, publishing, RSVP
```

## Quick start (no Docker)

```bash
# API — SQLite, local file storage, inline jobs, rule-based AI (no keys needed)
python3 -m venv .venv && .venv/bin/pip install -r apps/api/requirements.txt
cp apps/api/.env.example apps/api/.env
cd apps/api && ../../.venv/bin/uvicorn app.main:app --reload --port 8000

# Web
cd apps/web && npm install && npm run dev        # http://localhost:3000
```

The Next.js dev server proxies `/api/*` and `/media/*` to the API (`API_URL`,
default `http://localhost:8000`), so the browser only ever uses relative URLs.

Full stack with Postgres, Redis, Celery worker and MinIO (S3): `docker compose up`.

## Database migrations (Alembic)

The schema is versioned with Alembic (`apps/api/alembic`). `alembic/env.py`
reads `DATABASE_URL` from `app.core.config` (env var / `.env`) and targets
`Base.metadata` with the models from `app.models.models`.
`Base.metadata.create_all` only runs in dev/test (`APP_ENV=development|test`)
so a fresh checkout starts with zero setup — production-like environments run
migrations instead: `docker compose` executes `alembic upgrade head` before
the API starts serving.

```bash
make migrate                    # alembic upgrade head
make revision m="add foo"       # autogenerate a new migration after a model change

# manual use from apps/api:
../../.venv/bin/alembic upgrade head          # apply
../../.venv/bin/alembic downgrade -1          # roll back one revision
../../.venv/bin/alembic revision --autogenerate -m "message"
../../.venv/bin/alembic check                 # fail if models drifted from migrations
```

Already have a dev database created by `create_all`? Stamp it as migrated so
future revisions apply on top: `cd apps/api && ../../.venv/bin/alembic stamp head`.

## Architecture

### The Design DSL — the AI never writes HTML

Every event website is a structured `DesignDocument`
(`apps/web/src/design/schema.ts`, mirrored in `apps/api/app/design/schema.py`):

```json
{
  "meta":   { "conceptName": "Concept 01", "direction": "Editorial Romance", "rationale": "…" },
  "theme":  { "colors": {…}, "typography": { "headingFont": "Cormorant Garamond", "bodyFont": "Inter", "scale": "display", … },
              "spacing": "airy", "radius": "none", "shadows": "none", "decoration": "minimal",
              "animation": "subtle", "imageTreatment": "film" },
  "layout": { "maxWidth": 1200 },
  "sections": [ { "id": "sec_…", "type": "hero", "variant": "editorial", "props": {…}, "style": {…} }, … ]
}
```

* **Renderer** (`apps/web/src/renderer`) turns the document into a real,
  responsive site. Theme tokens become CSS variables; responsive rules use
  container queries so the editor can preview mobile without an iframe.
* **Tokens** (`design/tokens.ts`) — spacing, type scale, radius, shadows,
  image treatments, curated font library. Nothing in a site uses ad-hoc values.
* **Section variants** — e.g. hero: `centered · split · fullscreen · editorial · minimal · asymmetric`.
* **Operations** (`design/operations.ts`) — the *only* way the document changes,
  for both the manual editor and the AI:

```json
{ "operations": [
  { "target": "hero", "action": "update", "property": "style.headingSize", "value": "xl" },
  { "target": "theme.colors", "action": "update", "property": "accent", "value": "#66705A" },
  { "target": "hero.image", "action": "remove" },
  { "target": "#sec_ab12", "action": "set_variant", "value": "split" }
]}
```

Unknown targets are ignored and every value is validated, so an AI edit can
never break the site's structure.

### AI Design Engine (`apps/api/app/design`, `apps/api/app/ai`)

```
brief ─┐
       ├─▶ reference analysis ─▶ style profile ─▶ direction selection ─▶ palette + copy ─▶ 3 DesignDocuments
refs ──┘        (Pillow palettes,  (tags, colours,   (10 art directions;   (contrast‑safe
                 notes, stats)      dark?, decoration) diverse hero/type)   token palette)
```

* `directions.py` — ten opinionated art directions (Editorial Romance, Modern
  Mediterranean, Quiet Luxury, Modern Monochrome, Botanical Calm, Cinematic
  Night, Playful Bold, Clear & Considered, Warm Film, Soft Modern). Selection
  enforces diversity: different hero composition **and** type family.
* `engine.py` — reference analysis, style extraction, palette building,
  concept assembly. Deterministic; always produces valid, restrained output.
* `edit.py` — natural language (EN/RU) → structured operations. Handles
  "make the hero more premium", "remove gold", "use olive only for accents",
  "smaller heading", "modern font", "RSVP more prominent", "fix mobile", add /
  remove / move sections, warmer / darker, dark theme, etc.
* `lint.py` — design checks (contrast, hierarchy, over-decoration, missing
  imagery, mobile density) with one-click fix operations.
* `ai/providers` — pluggable LLM providers (`rules` default, `openai`,
  `anthropic`). An LLM enriches the style profile and can produce edit
  operations; everything is validated against the DSL and falls back to the
  rules engine. Business logic never depends on a vendor.

Endpoints: `POST /api/projects/{id}/ai/analyze-references · generate-design ·
select-concept · edit-design · check-design · generate-copy`.

### Domains

`Auth · Users · Projects · References · Assets · Generations · DesignVersions ·
AIEdits · Publications · RSVP` — see `apps/api/app/models/models.py`.

* **Auth**: built-in email/password JWT; set `SUPABASE_JWT_SECRET` to accept
  Supabase Auth tokens (users are provisioned on first request).
* **Storage**: local disk in dev, S3-compatible in prod; images are optimised
  (resized, EXIF-stripped, re-encoded) on upload.
* **Jobs**: Celery tasks; `CELERY_EAGER=true` runs them inline in development.
* **Publishing**: frozen snapshot per publish, slug, password protection, QR,
  unpublish, view counter. Custom domains are a column away.
* **Versions**: every save creates a `DesignVersion` (restore endpoint included).

### Frontend

* `/` landing · `/explore` · `/login` · `/signup`
* `/app` dashboard · `/app/new` wizard (type → brief → inspiration board → 3 directions)
* `/app/projects/:id/editor` — Sections (drag & drop), Assets, Design tokens,
  Inspiration on the left; canvas with inline text editing, image replacement
  and viewport switching in the middle; Properties / **AI Designer** (chat with
  before → after diff and Apply) on the right. Undo/redo, autosave, shortcuts
  (⌘Z, ⇧⌘Z, ⌘S, ⌘D, ⌫, ⌥↑↓, Esc).
* `/app/projects/:id/guests` — RSVP stats, table, CSV export
* `/e/:slug` — the public event website with a working RSVP form

## Design principles baked in

Typography first, strong hierarchy, whitespace, restrained palettes,
consistent spacing, editorial layouts, sophisticated image treatment, subtle
motion, mobile first. The engine actively removes metallic accents in quiet
directions, caps decoration, keeps only one display-size heading and checks
contrast. Better too simple and expensive than too decorated.

## Roadmap

P1 templates marketplace · P2 custom domains, analytics, payments,
collaboration. The data model and operation format are designed for them.
