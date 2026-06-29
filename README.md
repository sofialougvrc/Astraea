# Astraea — Stratigraphic Reconciliation & Anomaly Engine

Astraea is a 4D archaeological site modelling platform for stratigraphic reconciliation, Harris Matrix graph modelling, anomaly detection, radiocarbon uncertainty review, artifact/context analysis, and machine-assisted relationship suggestions. It is designed to ingest excavation records, photogrammetry references, artifact logs, and sparse absolute dates, then model site contexts as directed acyclic graphs with provisional missing-link suggestions and Bayesian-style dating uncertainty.

The upgraded workspace integrates real archaeological evidence:

- 660,857 Open Context CSV rows
- 5,296 canonical context signatures
- 1,119 Oaxaca radiocarbon samples
- 1,967 Open Context mapped records
- Upland shell and groundstone artifact count tables
- Extracted Harris Matrix visualization methodology notes

## Frontend

```bash
npm install
npm run dev
```

The React/Vite app runs at `http://localhost:5173`.

During local development, Vite proxies `/api/*` to `http://127.0.0.1:8000`, so the frontend avoids localhost/127.0.0.1 mismatch issues. To call a different backend directly, set:

```bash
export VITE_ASTRAEA_API_URL="http://127.0.0.1:8000/api"
```

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The FastAPI service runs at `http://localhost:8000`, with docs at `http://localhost:8000/docs`.

## Stack

- React, Vite, JavaScript, D3.js, SVG
- FastAPI, Python, Pydantic
- SQLAlchemy, PostgreSQL, PostGIS-ready models
- Source-aware Open Context normalization
- Radiocarbon uncertainty and chronology review
- Provisional Harris Matrix edge review
- PostGIS schema blueprint in `backend/app/db/postgis_schema.sql`
- PyTorch Geometric-ready ST-GNN service scaffold
- PyMC-ready Bayesian chronology service scaffold

## Database Note

The app ships with a normalized JSON evidence package so the research workspace can run immediately. The backend also includes a PostgreSQL/PostGIS schema blueprint for a deployed research database:

```bash
export ASTRAEA_DATABASE_URL="postgresql+psycopg://astraea:astraea@localhost:5432/astraea"
```

Machine-assisted graph edges and anomaly suggestions are explicitly labelled as provisional review prompts, not source-provided archaeological facts.
