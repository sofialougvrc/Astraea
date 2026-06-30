# Astraea

## Stratigraphic Reconciliation & Anomaly Engine

A computational archaeology workspace for reasoning across excavation records, stratigraphic relationships, artifact evidence, and radiocarbon data. It is designed as a research instrument rather than a static archive: contexts are normalized into reviewable units, relationships are exposed as Harris Matrix-style directed graphs, chronology is treated as uncertainty-aware rather than fixed, and anomaly signals are surfaced for investigation rather than silently absorbed into a dataset.

It brings together excavation records, artifact logs, field-note material, mapped evidence, and calibration datasets into a single interface for examining depositional sequences, chronology gaps, provisional graph links, and source-aware interpretations. Instead of presenting one authoritative reconstruction, Astraea makes ambiguity visible and keeps machine-assisted reasoning clearly separate from archaeological source evidence.

## Research focus

Astraea is built around a few core archaeological questions:

- How should heterogeneous excavation records be reconciled into comparable contexts?
- Which stratigraphic relationships are source-supported, and which remain provisional?
- Where does radiocarbon evidence constrain chronology, and where does uncertainty remain wide?
- Which contexts appear weakly connected, anomalous, or internally inconsistent?
- How can a researcher move from raw evidence to reviewable interpretive case files without losing citation trail or uncertainty?

## What the workspace does

- normalizes excavation and Open Context-style records into canonical context units
- represents stratigraphic relationships as Harris Matrix-style directed graphs
- surfaces provisional missing links, disconnected sequences, and weakly constrained phases
- calibrates chronology inputs against IntCal20, SHCal20, and Marine20 reference data
- exposes anomaly investigations, rival interpretations, and evidence-linked case files
- keeps machine-assisted suggestions visibly distinct from source-derived archaeological records
- includes a backend schema path for a larger PostgreSQL/PostGIS deployment

## Integrated evidence

The current workspace integrates a substantial archaeological evidence package, including:

- 660,857 Open Context CSV rows
- 5,296 canonical context signatures
- 1,119 Oaxaca radiocarbon samples
- 1,967 Open Context mapped records
- Upland shell and groundstone artifact count tables
- extracted Harris Matrix visualization methodology notes

This gives Astraea a multi-site comparative basis rather than a single synthetic demo dataset. The included evidence spans different regions, data structures, and archaeological record types, which is part of what makes reconciliation and chronology review meaningful inside the interface.

## Architecture

Astraea is split into two layers:

### Frontend

- React
- Vite
- JavaScript
- D3.js
- SVG

The frontend provides the research workspace itself: context browsing, Harris Matrix review, chronology views, anomaly panels, and interpretation-oriented evidence exploration.

### Backend

- FastAPI
- Python
- Pydantic
- SQLAlchemy
- PostgreSQL/PostGIS-ready models

The backend provides API routing, model structure, service scaffolding, and a path toward a larger database-backed deployment.

## Frontend setup

```bash
npm install
npm run dev
```

The React/Vite app runs at:

```text
http://localhost:5173
```

During development, Vite proxies `/api/*` to `http://127.0.0.1:8000`, which avoids localhost versus `127.0.0.1` mismatch issues when the FastAPI service is running locally.

To point the frontend at a different backend:

```bash
export VITE_ASTRAEA_API_URL="http://127.0.0.1:8000/api"
```

## Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The FastAPI service runs at:

```text
http://localhost:8000
```

Interactive API docs are available at:

```text
http://localhost:8000/docs
```

## Data and database layer

Astraea ships with a normalized JSON evidence package so the workspace can run immediately without requiring a database bootstrap step. At the same time, the backend includes a PostgreSQL/PostGIS-ready schema path for a fuller research deployment.

The schema blueprint is located at:

- `backend/app/db/postgis_schema.sql`

To target a PostgreSQL deployment explicitly:

```bash
export ASTRAEA_DATABASE_URL="postgresql+psycopg://astraea:astraea@localhost:5432/astraea"
```

## Current modeling status

Some components are already active in the workspace, while others are represented as research-oriented scaffolds for future extension.

### Active in the current application

- source-aware Open Context normalization
- Harris Matrix-style graph review
- radiocarbon uncertainty and chronology review
- anomaly and interpretation workflows
- SQLAlchemy model layer
- PostgreSQL/PostGIS-ready schema design

### Present as scaffolded extension points

- PyTorch Geometric-ready ST-GNN service scaffold
- PyMC-ready Bayesian chronology service scaffold

These scaffolded services are included so the architecture can support more advanced graph inference and chronology modeling later, but they should be understood as extension paths rather than as fully deployed model systems in the current runtime.

## Interpretation and citation discipline

Astraea is designed to support archaeological reasoning without collapsing source evidence and machine-assisted inference into the same category.

In practice, this means:

- source records remain source records
- provisional graph edges remain provisional
- anomaly prompts remain prompts for review
- generated case files are interpretive artifacts, not primary evidence

Machine-assisted graph edges and anomaly suggestions are explicitly labelled as review prompts rather than source-provided archaeological facts.

## Notes

- Chronology in Astraea is treated as uncertainty-aware rather than point-estimate driven
- The workspace is strongest when used comparatively: across contexts, across trench sequences, and across evidence layers
- The included evidence package is intended to make the system usable immediately while still preserving a path toward a larger database-backed deployment
