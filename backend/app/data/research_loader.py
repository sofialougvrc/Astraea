import json
from functools import lru_cache
from pathlib import Path


DATA_PATH = Path(__file__).with_name("astraea_research_data.json")


@lru_cache
def load_research_data() -> dict:
    with DATA_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def find_context(context_id: str) -> dict | None:
    data = load_research_data()
    return next((item for item in data["openContext"]["contexts"] if item["id"] == context_id), None)


def search_contexts(query: str = "", site: str = "", project: str = "", limit: int = 120) -> list[dict]:
    data = load_research_data()
    contexts = data["openContext"]["contexts"]
    query_l = query.lower().strip()
    site_l = site.lower().strip()
    project_l = project.lower().strip()

    def match(item: dict) -> bool:
        haystack = " ".join(
            str(item.get(key, ""))
            for key in ["id", "project", "site", "area", "unit", "strat", "feature", "depositionalContext", "sourceDataset"]
        ).lower()
        if query_l and query_l not in haystack:
            return False
        if site_l and site_l not in str(item.get("site", "")).lower():
            return False
        if project_l and project_l not in str(item.get("project", "")).lower():
            return False
        return True

    return [item for item in contexts if match(item)][: max(1, min(limit, 500))]


def radiocarbon_records(site: str = "", limit: int = 180) -> list[dict]:
    data = load_research_data()
    site_l = site.lower().strip()
    records = data["radiocarbon"]["records"]
    if site_l:
        records = [item for item in records if site_l in item.get("siteName", "").lower()]
    return records[: max(1, min(limit, 500))]
