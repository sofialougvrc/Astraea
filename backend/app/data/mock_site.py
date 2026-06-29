STRATIGRAPHIC_UNITS = [
    {
        "id": "SU-001",
        "label": "Modern topsoil",
        "phase": "Modern",
        "range": (1900, 2020),
        "prior": (1850, 2020),
        "posterior": (1915, 2018),
        "confidence": 94,
        "description": "Loose dark topsoil with recent root activity, modern ceramic fragments, and mixed surface finds.",
        "artifacts": [
            {"id": "A-101", "name": "glass bottle sherd", "date": (1920, 1980), "type": "domestic"},
            {"id": "A-102", "name": "plastic field marker", "date": (1970, 2020), "type": "modern"},
        ],
        "color": "#6e5d47",
    },
    {
        "id": "SU-002",
        "label": "Medieval occupation surface",
        "phase": "Medieval",
        "range": (1100, 1300),
        "prior": (1050, 1350),
        "posterior": (1125, 1290),
        "confidence": 86,
        "description": "Compacted trampled surface with hearth rake-out, handmade pottery, and a repair cut along the east baulk.",
        "artifacts": [
            {"id": "A-201", "name": "glazed bowl fragment", "date": (1120, 1280), "type": "ceramic"},
            {"id": "A-202", "name": "iron buckle", "date": (1150, 1320), "type": "metalwork"},
        ],
        "color": "#9a6f3a",
    },
    {
        "id": "SU-003",
        "label": "Roman destruction layer",
        "phase": "Roman",
        "range": (100, 250),
        "prior": (50, 280),
        "posterior": (120, 235),
        "confidence": 82,
        "description": "Compact ash-rich layer with roof tile, charcoal lenses, amphora fragments, and a coin minted under Nero.",
        "artifacts": [
            {"id": "A-301", "name": "Nero bronze coin", "date": (54, 68), "type": "numismatic"},
            {"id": "A-302", "name": "Dressel amphora fragment", "date": (50, 220), "type": "ceramic"},
        ],
        "color": "#7d3f32",
    },
    {
        "id": "SU-004",
        "label": "Hellenistic floor layer",
        "phase": "Hellenistic",
        "range": (-250, -100),
        "prior": (-350, -100),
        "posterior": (-275, -125),
        "confidence": 78,
        "description": "Prepared clay floor with lime flecks, worn surface polish, and small fragments of fineware.",
        "artifacts": [
            {"id": "A-401", "name": "black-gloss pottery", "date": (-300, -80), "type": "ceramic"},
            {"id": "A-402", "name": "loom weight", "date": (-350, -100), "type": "domestic"},
        ],
        "color": "#b58b52",
    },
    {
        "id": "SU-005",
        "label": "Iron Age fill",
        "phase": "Iron Age",
        "range": (-800, -500),
        "prior": (-900, -450),
        "posterior": (-760, -530),
        "confidence": 73,
        "description": "Mixed sandy occupation fill containing handmade pottery, slag flecks, and a shallow pit interface.",
        "artifacts": [
            {"id": "A-501", "name": "handmade coarseware", "date": (-850, -480), "type": "ceramic"},
            {"id": "A-502", "name": "iron slag", "date": (-800, -400), "type": "industrial"},
        ],
        "color": "#8f7357",
    },
    {
        "id": "SU-006",
        "label": "Bronze Age foundation deposit",
        "phase": "Bronze Age",
        "range": (-1800, -1200),
        "prior": (-1900, -1100),
        "posterior": (-1710, -1260),
        "confidence": 81,
        "description": "Stone-packed foundation trench with charcoal flecks and sealed coarse ceramic fragments.",
        "artifacts": [
            {"id": "A-601", "name": "burnished storage jar", "date": (-1850, -1250), "type": "ceramic"},
            {"id": "A-602", "name": "charcoal sample", "date": (-1680, -1320), "type": "radiocarbon"},
        ],
        "color": "#635247",
    },
    {
        "id": "SU-007",
        "label": "Sterile alluvial clay",
        "phase": "Natural",
        "range": (-2400, -1900),
        "prior": (-2600, -1800),
        "posterior": (-2350, -1950),
        "confidence": 91,
        "description": "Compact sterile clay without cultural material, interpreted as natural substrate for the excavated area.",
        "artifacts": [],
        "color": "#4d5665",
    },
]

RELATIONSHIPS = [
    {"id": "R-001", "source": "SU-001", "target": "SU-002", "type": "covers", "confidence": 0.96},
    {"id": "R-002", "source": "SU-002", "target": "SU-003", "type": "covers", "confidence": 0.88},
    {"id": "R-003", "source": "SU-003", "target": "SU-004", "type": "covers", "confidence": 0.9},
    {"id": "R-004", "source": "SU-004", "target": "SU-005", "type": "covers", "confidence": 0.86},
    {"id": "R-005", "source": "SU-005", "target": "SU-006", "type": "covers", "confidence": 0.8},
    {"id": "R-006", "source": "SU-006", "target": "SU-007", "type": "covers", "confidence": 0.92},
    {"id": "R-007", "source": "SU-002", "target": "SU-004", "type": "cuts", "confidence": 0.62},
    {"id": "R-008", "source": "SU-005", "target": "SU-006", "type": "abuts", "confidence": 0.7},
]

SCENARIOS = {
    "modern-coin": {
        "label": "Modern coin in Bronze Age deposit",
        "severity": 26,
        "affected_units": ["SU-006"],
        "added_artifacts": {
            "SU-006": [{"id": "A-904", "name": "1968 decimal coin", "date": (1968, 1968), "type": "numismatic"}]
        },
        "explanation": "Artifact A-904, dated 1968 CE, appears in SU-006, which is constrained by surrounding layers to 1800–1200 BCE.",
    },
    "bad-radiocarbon": {
        "label": "Radiocarbon date contradicts sequence",
        "severity": 19,
        "affected_units": ["SU-004", "SU-005"],
        "radiocarbon_shift": {"unit": "SU-004", "posterior": (-780, -620), "confidence": 51},
        "explanation": "A simulated radiocarbon determination pushes SU-004 into the Iron Age despite Hellenistic material evidence.",
    },
    "reverse-edge": {
        "label": "Reverse stratigraphic relationship",
        "severity": 23,
        "affected_units": ["SU-003", "SU-004"],
        "reverse_relationship": "R-003",
        "explanation": "The relationship between SU-003 and SU-004 has been reversed, creating a likely data-entry inversion.",
    },
    "late-pottery": {
        "label": "Late pottery style in early fill",
        "severity": 15,
        "affected_units": ["SU-005"],
        "added_artifacts": {
            "SU-005": [{"id": "A-805", "name": "late Roman red-slip sherd", "date": (300, 450), "type": "ceramic"}]
        },
        "explanation": "A pottery style dated 300–450 CE appears inside Iron Age fill.",
    },
    "bioturbation": {
        "label": "Intrusive material from bioturbation",
        "severity": 11,
        "affected_units": ["SU-006", "SU-005"],
        "added_artifacts": {
            "SU-006": [{"id": "A-707", "name": "medieval seed cluster", "date": (1150, 1280), "type": "botanical"}]
        },
        "explanation": "A medieval botanical cluster appears in a Bronze Age context through a plausible taphonomic pathway.",
    },
}
