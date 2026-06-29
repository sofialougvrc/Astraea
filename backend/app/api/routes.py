from fastapi import APIRouter

from app.data.mock_site import RELATIONSHIPS, SCENARIOS, STRATIGRAPHIC_UNITS
from app.data.research_loader import load_research_data, radiocarbon_records, search_contexts
from app.schemas.site import FieldNoteRequest, ScenarioRequest
from app.services.chronology_service import run_bayesian_chronology
from app.services.graph_service import build_relationships, build_units, run_query, score_site
from app.services.parser_service import parse_field_note
from app.services.stgnn_service import predict_missing_links

router = APIRouter()


@router.get("/health")
def health() -> dict:
    data = load_research_data()
    return {
        "status": "ok",
        "service": "Astraea API",
        "dataset": {
            "open_context_rows": data["reports"]["overview"]["totalOpenContextRows"],
            "canonical_contexts": data["reports"]["overview"]["totalCanonicalContexts"],
            "radiocarbon_samples": data["reports"]["overview"]["radiocarbonSamples"],
            "geo_records": data["reports"]["overview"]["geoRecords"],
        },
        "stack": ["FastAPI", "PostgreSQL/PostGIS-ready models", "PyTorch Geometric-ready ST-GNN service", "PyMC-ready chronology service"],
    }


@router.get("/research/overview")
def research_overview() -> dict:
    data = load_research_data()
    return {
        "metadata": data["metadata"],
        "overview": data["reports"]["overview"],
        "source_summaries": data["openContext"]["sourceSummaries"],
        "radiocarbon_summary": data["radiocarbon"]["summary"],
        "geo_summary": data["geoRecords"]["summary"],
        "upland_tables": [{key: value for key, value in table.items() if key != "records"} for table in data["uplandArtifactTables"]],
        "harris_methodology": data["harrisMethodology"],
    }


@router.get("/research/contexts")
def research_contexts(query: str = "", site: str = "", project: str = "", limit: int = 120) -> dict:
    return {"contexts": search_contexts(query=query, site=site, project=project, limit=limit)}


@router.get("/research/radiocarbon")
def research_radiocarbon(site: str = "", limit: int = 180) -> dict:
    data = load_research_data()
    return {"summary": data["radiocarbon"]["summary"], "records": radiocarbon_records(site=site, limit=limit)}


@router.get("/research/graph")
def research_graph(limit: int = 180) -> dict:
    data = load_research_data()
    max_items = max(1, min(limit, 400))
    return {
        "contexts": data["reports"]["strongContexts"][:max_items],
        "relationships": data["openContext"]["relationshipCandidates"][:max_items],
        "methodology": data["harrisMethodology"],
    }


@router.get("/research/anomalies")
def research_anomalies(limit: int = 180) -> dict:
    data = load_research_data()
    return {
        "anomalies": data["reports"]["anomalies"][: max(1, min(limit, 500))],
        "ml_suggestions": data["reports"]["mlSuggestions"][: max(1, min(limit, 500))],
    }


@router.get("/research/evidence-map")
def research_evidence_map(limit: int = 500) -> dict:
    data = load_research_data()
    return {
        "geo_records": data["geoRecords"]["records"][: max(1, min(limit, 1967))],
        "contexts": [item for item in data["openContext"]["contexts"] if item.get("centroid")][: max(1, min(limit, 850))],
    }


@router.get("/research/report")
def research_report() -> dict:
    data = load_research_data()
    overview = data["reports"]["overview"]
    lines = [
        "# Astraea Research Report",
        "",
        f"Open Context rows normalized: {overview['totalOpenContextRows']:,}",
        f"Canonical contexts identified: {overview['totalCanonicalContexts']:,}",
        f"Radiocarbon samples integrated: {overview['radiocarbonSamples']:,}",
        f"Mapped Open Context records: {overview['geoRecords']:,}",
        "",
        "## Analytical Position",
        overview["positioning"],
        "",
        "## Important Caution",
        "Astraea separates source evidence from machine-assisted suggestions. Provisional Harris Matrix edges require archaeological review before interpretation.",
    ]
    return {"markdown": "\n".join(lines)}


@router.get("/sites/demo")
def get_demo_site() -> dict:
    return {
        "site": {
            "code": "ASTRAEA-DEMO-001",
            "name": "Demo Trench A",
            "region": "Eastern Mediterranean research simulation",
        },
        "units": STRATIGRAPHIC_UNITS,
        "relationships": RELATIONSHIPS,
        "scenarios": [{"id": key, **value} for key, value in SCENARIOS.items()],
    }


@router.post("/model/evaluate")
def evaluate_model(request: ScenarioRequest) -> dict:
    return score_site(request.scenario_id)


@router.post("/chronology/run")
def run_chronology(request: ScenarioRequest) -> dict:
    return {"results": run_bayesian_chronology(request.scenario_id)}


@router.post("/stgnn/predict-links")
def predict_links(request: ScenarioRequest) -> dict:
    return {"predictions": predict_missing_links(request.scenario_id)}


@router.post("/field-notes/parse")
def parse_notes(request: FieldNoteRequest) -> dict:
    return parse_field_note(request.note)


@router.get("/queries/{query_id}")
def query_site(query_id: str, scenario_id: str = "baseline") -> dict:
    return run_query(query_id, scenario_id)


@router.get("/units")
def list_units(scenario_id: str = "baseline") -> dict:
    return {"units": build_units(scenario_id)}


@router.get("/relationships")
def list_relationships(scenario_id: str = "baseline") -> dict:
    return {"relationships": build_relationships(scenario_id)}
