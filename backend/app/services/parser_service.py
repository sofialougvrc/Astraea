def parse_field_note(note: str) -> dict:
    lower = note.lower()
    entities = [unit_id for unit_id in ["SU-001", "SU-002", "SU-003", "SU-004", "SU-005", "SU-006", "SU-007"] if unit_id in note]
    relationships = []
    artifacts = []
    markers = []

    if "covering" in lower or "covers" in lower:
        relationships.append("covers")
    if "below" in lower:
        relationships.append("below / covered by")
    if "cuts" in lower:
        relationships.append("cuts")
    if "amphora" in lower:
        artifacts.append("Roman amphora fragments")
    if "coin" in lower or "nero" in lower:
        artifacts.append("Nero coin marker")
    if "ash" in lower or "burn" in lower:
        markers.append("burning event")
    if "roman" in lower:
        markers.append("Roman phase")
    if "earlier" in lower:
        markers.append("relative chronology cue")

    return {
        "entities": entities,
        "relationships": relationships,
        "artifacts": artifacts,
        "markers": markers,
        "parser": "LayoutLM-style mock extractor",
    }
