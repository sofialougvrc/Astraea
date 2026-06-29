from app.services.graph_service import build_units


def run_bayesian_chronology(scenario_id: str = "baseline") -> list[dict]:
    """Mock PyMC-style posterior chronology results.

    The production version would build a PyMC model where relative sequence
    constraints and absolute dates become priors/likelihoods. This service keeps
    the response deterministic for local demos while preserving the API shape.
    """
    chronology = []
    for unit in build_units(scenario_id):
        prior = tuple(unit["prior"])
        posterior = tuple(unit["posterior"])
        uncertainty = abs(posterior[1] - posterior[0])
        chronology.append(
            {
                "unit_id": unit["id"],
                "prior": prior,
                "posterior": posterior,
                "confidence": unit["confidence"],
                "sampler": f"mock-nuts-4chains-uncertainty-{uncertainty}",
            }
        )
    return chronology
