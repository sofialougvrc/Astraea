import { anomalyScenarios, baseRelationships, stratigraphicUnits } from '../data/siteData.js';

export function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BCE`;
  return `${year} CE`;
}

export function formatRange([start, end]) {
  return `${formatYear(start)} – ${formatYear(end)}`;
}

export function getScenario(id) {
  return anomalyScenarios.find(scenario => scenario.id === id);
}

export function buildUnits(activeScenarioId) {
  const scenario = getScenario(activeScenarioId);

  return stratigraphicUnits.map(unit => {
    const addedArtifacts = scenario?.addedArtifacts?.[unit.id] || [];
    const shifted = scenario?.radiocarbonShift?.unit === unit.id;
    return {
      ...unit,
      artifacts: [...unit.artifacts, ...addedArtifacts],
      posterior: shifted ? scenario.radiocarbonShift.posterior : unit.posterior,
      confidence: shifted ? scenario.radiocarbonShift.confidence : unit.confidence,
      anomalous: scenario?.affectedUnits?.includes(unit.id) || false,
    };
  });
}

export function buildRelationships(activeScenarioId) {
  const scenario = getScenario(activeScenarioId);
  if (!scenario?.reverseRelationship) return baseRelationships;

  return baseRelationships.map(relationship => {
    if (relationship.id !== scenario.reverseRelationship) return relationship;
    return {
      ...relationship,
      source: relationship.target,
      target: relationship.source,
      reversed: true,
      confidence: 0.38,
    };
  });
}

function hasDateOverlap(unitRange, artifactRange) {
  return Math.max(unitRange[0], artifactRange[0]) <= Math.min(unitRange[1], artifactRange[1]);
}

export function detectContradictions(units, relationships, activeScenarioId) {
  const contradictions = [];
  const scenario = getScenario(activeScenarioId);

  units.forEach(unit => {
    unit.artifacts.forEach(artifact => {
      if (!hasDateOverlap(unit.range, artifact.date)) {
        contradictions.push({
          type: 'Artifact-layer mismatch',
          unit: unit.id,
          artifact: artifact.id,
          severity: artifact.date[0] > unit.range[1] ? 'late intrusion' : 'residual material',
          message: `${artifact.name} (${formatRange(artifact.date)}) conflicts with ${unit.id} (${formatRange(unit.range)}).`,
        });
      }
    });

    if (!hasDateOverlap(unit.range, unit.posterior)) {
      contradictions.push({
        type: 'Chronology mismatch',
        unit: unit.id,
        severity: 'posterior outside prior',
        message: `${unit.id} posterior ${formatRange(unit.posterior)} falls outside its expected layer range ${formatRange(unit.range)}.`,
      });
    }
  });

  relationships.forEach(relationship => {
    const source = units.find(unit => unit.id === relationship.source);
    const target = units.find(unit => unit.id === relationship.target);
    if (!source || !target) return;

    if (source.range[0] < target.range[0] && relationship.type === 'covers') {
      contradictions.push({
        type: 'Relationship inversion',
        unit: relationship.source,
        severity: 'DAG direction warning',
        message: `${relationship.source} is modelled as covering ${relationship.target}, but its date range is earlier than the covered context.`,
      });
    }
  });

  if (scenario?.explanation) {
    contradictions.unshift({
      type: 'Scenario anomaly',
      unit: scenario.affectedUnits?.join(', '),
      severity: scenario.label,
      message: scenario.explanation,
    });
  }

  return contradictions;
}

export function scoreSite(units, relationships, activeScenarioId) {
  const scenario = getScenario(activeScenarioId);
  const contradictions = detectContradictions(units, relationships, activeScenarioId);
  const relationshipConfidencePenalty = relationships.reduce((sum, relationship) => sum + (1 - relationship.confidence) * 2.4, 0);
  const evidenceConfidencePenalty = units.reduce((sum, unit) => sum + (100 - unit.confidence) / 36, 0);
  const scenarioPenalty = scenario?.severity || 0;
  const contradictionPenalty = Math.min(36, contradictions.length * 5.5);

  const score = Math.max(0, Math.round(100 - scenarioPenalty - contradictionPenalty - relationshipConfidencePenalty - evidenceConfidencePenalty));
  let status = 'Stable';
  if (score < 82) status = 'Uncertain';
  if (score < 62) status = 'Contradictory';
  if (score < 42) status = 'Critical';

  const loweredBy = [
    contradictions.length ? `${contradictions.length} contradiction signal${contradictions.length === 1 ? '' : 's'}` : 'no major contradictions',
    scenario ? scenario.label : 'baseline evidence confidence',
    relationshipConfidencePenalty > 3 ? 'low-confidence stratigraphic edges' : 'relationship graph mostly stable',
  ];

  return { score, status, contradictions, loweredBy };
}

export function parseFieldNotes(note) {
  const lower = note.toLowerCase();
  const entities = [];
  const relationships = [];
  const artifacts = [];
  const markers = [];

  ['SU-001', 'SU-002', 'SU-003', 'SU-004', 'SU-005', 'SU-006', 'SU-007'].forEach(id => {
    if (note.includes(id)) entities.push(id);
  });
  if (lower.includes('covering')) relationships.push('covers');
  if (lower.includes('below')) relationships.push('below / covered by');
  if (lower.includes('amphora')) artifacts.push('Roman amphora fragments');
  if (lower.includes('coin')) artifacts.push('Nero coin marker');
  if (lower.includes('ash') || lower.includes('burn')) markers.push('burning event');
  if (lower.includes('roman')) markers.push('Roman phase');
  if (lower.includes('earlier')) markers.push('relative chronology cue');

  return { entities, relationships, artifacts, markers };
}

export function runHistorianQuery(queryId, units, contradictions) {
  const contradictionUnits = new Set(contradictions.map(item => item.unit).filter(Boolean).flatMap(value => String(value).split(', ')));
  const queries = {
    burning: {
      title: 'Layers associated with burning events',
      units: units.filter(unit => /ash|charcoal|burn|destruction/i.test(unit.description)).map(unit => unit.id),
      answer: 'Burning evidence clusters around the Roman destruction layer and charcoal-bearing foundation contexts.',
    },
    contradictions: {
      title: 'Layers with date contradictions',
      units: units.filter(unit => contradictionUnits.has(unit.id)).map(unit => unit.id),
      answer: 'The highlighted units contain artifact, radiocarbon, or relationship evidence that conflicts with the current stratigraphic model.',
    },
    intrusive: {
      title: 'Possible intrusive artifacts',
      units: units.filter(unit => unit.artifacts.some(artifact => !hasDateOverlap(unit.range, artifact.date))).map(unit => unit.id),
      answer: 'Intrusive material is likely where artifact dates are much later than the sealed depositional context.',
    },
    roman: {
      title: 'Likely Roman phase layers',
      units: units.filter(unit => unit.phase === 'Roman' || unit.artifacts.some(artifact => /Roman|Nero|amphora/i.test(artifact.name))).map(unit => unit.id),
      answer: 'The Roman phase is centred on SU-003, supported by amphora fragments, burning evidence, and a Nero coin marker.',
    },
    uncertain: {
      title: 'Where chronology becomes uncertain',
      units: units.filter(unit => unit.confidence < 80).map(unit => unit.id),
      answer: 'Chronological uncertainty increases in layers with broad priors, mixed fill, or low-confidence posterior estimates.',
    },
  };

  return queries[queryId] || queries.burning;
}
