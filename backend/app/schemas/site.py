from pydantic import BaseModel, Field


class ArtifactSchema(BaseModel):
    id: str
    name: str
    date: tuple[int, int]
    type: str


class StratigraphicUnitSchema(BaseModel):
    id: str
    label: str
    phase: str
    range: tuple[int, int]
    prior: tuple[int, int]
    posterior: tuple[int, int]
    confidence: float
    description: str
    artifacts: list[ArtifactSchema]
    color: str
    anomalous: bool = False


class RelationshipSchema(BaseModel):
    id: str
    source: str
    target: str
    type: str
    confidence: float
    reversed: bool = False


class ScenarioRequest(BaseModel):
    scenario_id: str = Field(default="baseline")


class FieldNoteRequest(BaseModel):
    note: str


class QueryResponse(BaseModel):
    title: str
    units: list[str]
    answer: str


class ScoreResponse(BaseModel):
    score: int
    status: str
    lowered_by: list[str]
    contradictions: list[dict]
    units: list[StratigraphicUnitSchema]
    relationships: list[RelationshipSchema]


class ChronologyResponse(BaseModel):
    unit_id: str
    prior: tuple[int, int]
    posterior: tuple[int, int]
    confidence: float
    sampler: str


class LinkPredictionResponse(BaseModel):
    source: str
    target: str
    probability: float
    rationale: str
