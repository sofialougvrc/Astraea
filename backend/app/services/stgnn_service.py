from app.services.graph_service import build_relationships, build_units


def predict_missing_links(scenario_id: str = "baseline") -> list[dict]:
    """Mock PyTorch Geometric ST-GNN link predictions.

    A real implementation would transform units and relationships into a
    torch_geometric.data.Data object with temporal/spatial features, then score
    candidate edges. This deterministic version exposes the same kind of output.
    """
    units = build_units(scenario_id)
    relationships = build_relationships(scenario_id)
    existing = {(edge["source"], edge["target"]) for edge in relationships}
    candidates = []

    for upper, lower in zip(units[:-1], units[1:]):
        if (upper["id"], lower["id"]) not in existing:
            candidates.append(
                {
                    "source": upper["id"],
                    "target": lower["id"],
                    "probability": 0.72,
                    "rationale": "Adjacent vertical position and compatible chronology suggest a missing covers edge.",
                }
            )

    candidates.extend(
        [
            {
                "source": "SU-003",
                "target": "SU-005",
                "probability": 0.41,
                "rationale": "Ash-rich Roman context may relate to deeper occupation fill, but intervening floor layer lowers confidence.",
            },
            {
                "source": "SU-002",
                "target": "SU-004",
                "probability": 0.63,
                "rationale": "Repair cut and stratigraphic shortcut indicate a possible intrusive cut relationship.",
            },
        ]
    )
    return candidates
