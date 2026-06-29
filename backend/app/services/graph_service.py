from copy import deepcopy

from app.data.mock_site import RELATIONSHIPS, SCENARIOS, STRATIGRAPHIC_UNITS


def date_overlap(left: tuple[int, int], right: tuple[int, int]) -> bool:
    return max(left[0], right[0]) <= min(left[1], right[1])


def build_units(scenario_id: str = "baseline") -> list[dict]:
    scenario = SCENARIOS.get(scenario_id)
    units = deepcopy(STRATIGRAPHIC_UNITS)

    if not scenario:
        return [{**unit, "anomalous": False} for unit in units]

    for unit in units:
        unit["anomalous"] = unit["id"] in scenario.get("affected_units", [])
        unit["artifacts"].extend(scenario.get("added_artifacts", {}).get(unit["id"], []))
        shift = scenario.get("radiocarbon_shift")
        if shift and shift["unit"] == unit["id"]:
            unit["posterior"] = tuple(shift["posterior"])
            unit["confidence"] = shift["confidence"]

    return units


def build_relationships(scenario_id: str = "baseline") -> list[dict]:
    scenario = SCENARIOS.get(scenario_id)
    relationships = deepcopy(RELATIONSHIPS)

    if not scenario or not scenario.get("reverse_relationship"):
        return relationships

    for relationship in relationships:
        if relationship["id"] == scenario["reverse_relationship"]:
            relationship["source"], relationship["target"] = relationship["target"], relationship["source"]
            relationship["confidence"] = 0.38
            relationship["reversed"] = True
    return relationships


def detect_contradictions(units: list[dict], relationships: list[dict], scenario_id: str = "baseline") -> list[dict]:
    contradictions: list[dict] = []
    scenario = SCENARIOS.get(scenario_id)

    for unit in units:
        for artifact in unit["artifacts"]:
            if not date_overlap(tuple(unit["range"]), tuple(artifact["date"])):
                contradictions.append(
                    {
                        "type": "Artifact-layer mismatch",
                        "unit": unit["id"],
                        "artifact": artifact["id"],
                        "message": f"{artifact['name']} conflicts with {unit['id']} chronological constraints.",
                    }
                )

        if not date_overlap(tuple(unit["range"]), tuple(unit["posterior"])):
            contradictions.append(
                {
                    "type": "Chronology mismatch",
                    "unit": unit["id"],
                    "message": f"{unit['id']} posterior range falls outside its expected stratigraphic date range.",
                }
            )

    unit_lookup = {unit["id"]: unit for unit in units}
    for relationship in relationships:
        source = unit_lookup.get(relationship["source"])
        target = unit_lookup.get(relationship["target"])
        if source and target and relationship["type"] == "covers" and source["range"][0] < target["range"][0]:
            contradictions.append(
                {
                    "type": "Relationship inversion",
                    "unit": relationship["source"],
                    "message": f"{relationship['source']} is modelled as covering {relationship['target']} but appears earlier.",
                }
            )

    if scenario:
        contradictions.insert(
            0,
            {
                "type": "Scenario anomaly",
                "unit": ", ".join(scenario.get("affected_units", [])),
                "message": scenario["explanation"],
            },
        )

    return contradictions


def score_site(scenario_id: str = "baseline") -> dict:
    units = build_units(scenario_id)
    relationships = build_relationships(scenario_id)
    contradictions = detect_contradictions(units, relationships, scenario_id)
    scenario = SCENARIOS.get(scenario_id)

    relationship_penalty = sum((1 - relationship["confidence"]) * 2.4 for relationship in relationships)
    evidence_penalty = sum((100 - unit["confidence"]) / 36 for unit in units)
    scenario_penalty = scenario["severity"] if scenario else 0
    contradiction_penalty = min(36, len(contradictions) * 5.5)
    score = max(0, round(100 - relationship_penalty - evidence_penalty - scenario_penalty - contradiction_penalty))

    status = "Stable"
    if score < 82:
        status = "Uncertain"
    if score < 62:
        status = "Contradictory"
    if score < 42:
        status = "Critical"

    lowered_by = [
        f"{len(contradictions)} contradiction signal{'s' if len(contradictions) != 1 else ''}" if contradictions else "no major contradictions",
        scenario["label"] if scenario else "baseline evidence confidence",
        "low-confidence stratigraphic edges" if relationship_penalty > 3 else "relationship graph mostly stable",
    ]

    return {
        "score": score,
        "status": status,
        "lowered_by": lowered_by,
        "contradictions": contradictions,
        "units": units,
        "relationships": relationships,
    }


def run_query(query_id: str, scenario_id: str = "baseline") -> dict:
    report = score_site(scenario_id)
    units = report["units"]
    contradiction_units = {
        unit_id
        for contradiction in report["contradictions"]
        for unit_id in str(contradiction.get("unit", "")).split(", ")
        if unit_id
    }

    queries = {
        "burning": {
            "title": "Layers associated with burning events",
            "units": [unit["id"] for unit in units if any(term in unit["description"].lower() for term in ["ash", "charcoal", "burn", "destruction"])],
            "answer": "Burning evidence clusters around ash-rich destruction and charcoal-bearing contexts.",
        },
        "contradictions": {
            "title": "Layers with date contradictions",
            "units": [unit["id"] for unit in units if unit["id"] in contradiction_units],
            "answer": "Highlighted units contain artifact, radiocarbon, or relationship conflicts.",
        },
        "intrusive": {
            "title": "Possible intrusive artifacts",
            "units": [
                unit["id"]
                for unit in units
                if any(not date_overlap(tuple(unit["range"]), tuple(artifact["date"])) for artifact in unit["artifacts"])
            ],
            "answer": "Intrusive material is likely where artifact dates are much later than the sealed depositional context.",
        },
        "roman": {
            "title": "Likely Roman phase layers",
            "units": [
                unit["id"]
                for unit in units
                if unit["phase"] == "Roman" or any("roman" in artifact["name"].lower() or "nero" in artifact["name"].lower() for artifact in unit["artifacts"])
            ],
            "answer": "The Roman phase is centred on SU-003, supported by amphora fragments and a Nero coin marker.",
        },
        "uncertain": {
            "title": "Where chronology becomes uncertain",
            "units": [unit["id"] for unit in units if unit["confidence"] < 80],
            "answer": "Chronological uncertainty increases in layers with broad priors, mixed fill, or low-confidence posterior estimates.",
        },
    }

    return queries.get(query_id, queries["burning"])
