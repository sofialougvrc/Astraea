-- Astraea PostgreSQL + PostGIS schema blueprint.
-- The local app ships with a normalized JSON evidence package for immediate use.
-- This schema documents the production relational/spatial model for a deployed research service.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS source_documents (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  role TEXT NOT NULL,
  citation TEXT,
  row_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS archaeological_contexts (
  id TEXT PRIMARY KEY,
  project TEXT,
  site TEXT,
  area TEXT,
  excavation_unit TEXT,
  stratigraphic_unit TEXT,
  feature TEXT,
  level_label TEXT,
  depositional_context TEXT,
  context_path TEXT[],
  record_count INTEGER NOT NULL DEFAULT 0,
  early_year DOUBLE PRECISION,
  late_year DOUBLE PRECISION,
  confidence DOUBLE PRECISION,
  source_dataset TEXT,
  source_files TEXT[],
  geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_arch_contexts_geom ON archaeological_contexts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_arch_contexts_site ON archaeological_contexts (site);
CREATE INDEX IF NOT EXISTS idx_arch_contexts_project ON archaeological_contexts (project);

CREATE TABLE IF NOT EXISTS artifact_evidence (
  id BIGSERIAL PRIMARY KEY,
  context_id TEXT REFERENCES archaeological_contexts(id),
  label TEXT,
  uri TEXT,
  category TEXT,
  material TEXT,
  taxon TEXT,
  anatomical_element TEXT,
  early_year DOUBLE PRECISION,
  late_year DOUBLE PRECISION,
  source_dataset TEXT,
  raw_record JSONB
);

CREATE TABLE IF NOT EXISTS radiocarbon_samples (
  lab_number TEXT PRIMARY KEY,
  site_name TEXT,
  excavation_unit TEXT,
  stratigraphic_unit TEXT,
  feature TEXT,
  material TEXT,
  taxon TEXT,
  normalized_age DOUBLE PRECISION,
  normalized_sigma DOUBLE PRECISION,
  measured_age DOUBLE PRECISION,
  measured_sigma DOUBLE PRECISION,
  delta_13c DOUBLE PRECISION,
  reference TEXT,
  citation TEXT,
  quality_flags TEXT[],
  geom GEOMETRY(Point, 4326)
);

CREATE INDEX IF NOT EXISTS idx_radiocarbon_geom ON radiocarbon_samples USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_radiocarbon_site ON radiocarbon_samples (site_name);

CREATE TABLE IF NOT EXISTS harris_matrix_edges (
  id TEXT PRIMARY KEY,
  source_context_id TEXT REFERENCES archaeological_contexts(id),
  target_context_id TEXT REFERENCES archaeological_contexts(id),
  relation_type TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  basis TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  machine_assisted BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS anomaly_reviews (
  id BIGSERIAL PRIMARY KEY,
  record_label TEXT,
  context_id TEXT,
  site TEXT,
  anomaly_type TEXT,
  evidence TEXT,
  source_dataset TEXT,
  severity INTEGER,
  review_status TEXT NOT NULL DEFAULT 'open',
  reviewer_note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS field_notes (
  id BIGSERIAL PRIMARY KEY,
  context_id TEXT,
  note_text TEXT NOT NULL,
  extracted_entities JSONB,
  source_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
