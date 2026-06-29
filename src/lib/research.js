import dataset from '../data/astraeaResearchData.json';
import { calibrateRadiocarbonSample, calibrationCurveSummaries, chooseCalibrationCurve } from './calibration.js';

export const researchData = dataset;

export function number(value) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

export function pct(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function formatYear(year) {
  if (year === null || year === undefined || Number.isNaN(Number(year))) return 'unknown';
  const rounded = Math.round(Number(year));
  if (rounded < 0) return `${Math.abs(rounded)} BCE`;
  return `${rounded} CE`;
}

export function formatRange(range) {
  if (!range || (range[0] === null && range[1] === null)) return 'undated';
  return `${formatYear(range[0])} – ${formatYear(range[1])}`;
}

export function sourceShortName(file) {
  return String(file || '').replace(/--v1--full\.csv$/, '').replace(/\.xlsx|\.json|\.pdf/g, '');
}

export function filterContexts({ query = '', site = '', project = '', source = '', limit = 140 } = {}) {
  const q = query.trim().toLowerCase();
  const s = site.trim().toLowerCase();
  const p = project.trim().toLowerCase();
  const src = source.trim().toLowerCase();
  return researchData.openContext.contexts.filter(context => {
    const haystack = [
      context.id,
      context.project,
      context.site,
      context.area,
      context.unit,
      context.strat,
      context.feature,
      context.depositionalContext,
      context.sourceDataset,
      context.contextPath?.join(' '),
    ].join(' ').toLowerCase();
    if (q && !haystack.includes(q)) return false;
    if (s && !String(context.site).toLowerCase().includes(s)) return false;
    if (p && !String(context.project).toLowerCase().includes(p)) return false;
    if (src && !String(context.sourceDataset).toLowerCase().includes(src)) return false;
    return true;
  }).slice(0, limit);
}

export function contextLabel(context) {
  if (!context) return 'No context selected';
  const bits = [context.site, context.area, context.unit && `Unit ${context.unit}`, context.strat && `Strat ${context.strat}`].filter(Boolean);
  return bits.join(' · ') || context.id;
}

function buildDrawableContextEdges(contexts) {
  const groups = new Map();
  contexts.forEach(context => {
    const key = [context.project, context.site, context.area || context.sourceDataset].join('::');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(context);
  });

  const edges = [];
  Array.from(groups.values())
    .filter(group => group.length > 1)
    .sort((a, b) => b.length - a.length)
    .forEach(group => {
      const ordered = group
        .slice()
        .sort((a, b) => {
          const aStart = a.dateRange?.[0] ?? 999999;
          const bStart = b.dateRange?.[0] ?? 999999;
          if (aStart !== bStart) return aStart - bStart;
          return String(a.contextPath?.join('/') || a.id).localeCompare(String(b.contextPath?.join('/') || b.id));
        })
        .slice(0, 18);

      for (let index = 0; index < ordered.length - 1 && edges.length < 180; index += 1) {
        const source = ordered[index];
        const target = ordered[index + 1];
        edges.push({
          id: `LOAD-${edges.length + 1}`,
          source: source.id,
          target: target.id,
          type: 'loaded context sequence',
          confidence: Math.round((Math.min(source.confidence || 55, target.confidence || 55) / 100) * 100) / 100,
          basis: `Constructed from loaded contexts in ${source.site || source.project}: grouped by project/site/area and ordered by date range plus context hierarchy. Requires expert Harris Matrix review.`,
        });
      }
    });

  return edges;
}

export function getGraphModel(contexts, reviewState = {}, manualRelationships = []) {
  const allContexts = researchData.openContext.contexts;
  const contextById = new Map(allContexts.map(context => [context.id, context]));
  const visibleContextIds = new Set(contexts.map(context => context.id));
  const drawableGeneratedEdges = buildDrawableContextEdges(allContexts);
  const candidateEdges = [
    ...manualRelationships.map(edge => ({ ...edge, manual: true, confidence: Number(edge.confidence ?? 0.72) })),
    ...researchData.openContext.relationshipCandidates.filter(edge => contextById.has(edge.source) && contextById.has(edge.target)),
    ...drawableGeneratedEdges,
  ].filter(edge => contextById.has(edge.source) && contextById.has(edge.target));

  let scope = 'filtered context relationships';
  let relationships = candidateEdges.filter(edge => visibleContextIds.has(edge.source) && visibleContextIds.has(edge.target));

  if (relationships.length < 4 && visibleContextIds.size) {
    relationships = candidateEdges.filter(edge => visibleContextIds.has(edge.source) || visibleContextIds.has(edge.target));
    scope = 'filtered context neighborhood';
  }

  if (relationships.length < 4) {
    relationships = candidateEdges.slice(0, 120);
    scope = 'global provisional graph sample';
  }

  relationships = relationships
    .slice(0, 140)
    .map(edge => ({
      ...edge,
      reviewStatus: reviewState[edge.id] || 'pending',
    }));

  const relationshipIds = new Set(relationships.flatMap(edge => [edge.source, edge.target]));
  const nodes = Array.from(relationshipIds)
    .map(id => contextById.get(id))
    .filter(Boolean)
    .slice(0, 160)
    .map(context => ({
      id: context.id,
      label: context.unit || context.strat || context.site || context.id,
      site: context.site,
      area: context.area,
      unit: context.unit,
      strat: context.strat,
      phase: formatRange(context.dateRange),
      recordCount: context.recordCount,
      confidence: context.confidence,
      sourceDataset: context.sourceDataset,
      color: context.confidence > 82 ? '#b08d2f' : context.confidence > 70 ? '#c9a85a' : '#8b5e34',
    }));

  return {
    nodes,
    relationships,
    scope,
    totalCandidateEdges: candidateEdges.length,
    visibleContextCount: visibleContextIds.size,
  };
}

export function chronologyForSite(site = '') {
  const siteLower = site.toLowerCase();
  const records = researchData.radiocarbon.records
    .filter(record => !siteLower || String(record.siteName).toLowerCase().includes(siteLower))
    .filter(record => record.normalizedAge !== null)
    .slice(0, 180);
  const ages = records.map(record => record.normalizedAge).filter(value => value !== null);
  return {
    records,
    min: Math.min(...ages, 0),
    max: Math.max(...ages, 1),
    flagged: records.filter(record => record.qualityFlags?.length).length,
  };
}

export function compareSites(leftSite, rightSite) {
  function summarize(site) {
    const contexts = researchData.openContext.contexts.filter(context => context.site === site);
    const radiocarbon = researchData.radiocarbon.records.filter(record => record.siteName === site);
    const records = contexts.reduce((sum, context) => sum + context.recordCount, 0);
    const taxa = new Map();
    contexts.forEach(context => context.taxa?.forEach(([name, count]) => taxa.set(name, (taxa.get(name) || 0) + count)));
    return {
      site,
      contexts: contexts.length,
      records,
      radiocarbon: radiocarbon.length,
      topTaxa: Array.from(taxa.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
      dateSpan: contexts.reduce((range, context) => {
        const [a, b] = context.dateRange || [];
        return [a === null || a === undefined ? range[0] : Math.min(range[0], a), b === null || b === undefined ? range[1] : Math.max(range[1], b)];
      }, [Infinity, -Infinity]),
    };
  }
  return [summarize(leftSite), summarize(rightSite)];
}

export function stratigraphicConsistencyScore(context, reviewState = {}, anomalyReview = {}) {
  if (!context) return { score: 0, level: 'No context', factors: [] };
  const anomalyHits = researchData.reports.anomalies.filter(item => item.context === context.id);
  const acceptedAnomalies = anomalyHits.filter((item, index) => anomalyReview[`${item.record}-${index}`] === 'accepted').length;
  const dateScore = context.dateRange?.[0] !== null && context.dateRange?.[1] !== null ? 18 : 5;
  const sourceScore = context.sourceFiles?.length ? Math.min(16, 7 + context.sourceFiles.length * 2) : 4;
  const recordScore = Math.min(18, Math.round(Math.log10((context.recordCount || 0) + 1) * 7));
  const coordinateScore = context.centroid ? 12 : 3;
  const confidenceScore = Math.round((context.confidence || 0) * 0.24);
  const anomalyPenalty = Math.min(28, anomalyHits.length * 4 + acceptedAnomalies * 6);
  const reviewPenalty = Object.values(reviewState).filter(value => value === 'rejected').length > 8 ? 5 : 0;
  const score = Math.max(0, Math.min(100, dateScore + sourceScore + recordScore + coordinateScore + confidenceScore - anomalyPenalty - reviewPenalty));
  return {
    score,
    level: score >= 82 ? 'Publication-ready candidate' : score >= 64 ? 'Usable with caveats' : score >= 42 ? 'Needs review' : 'High-risk context',
    factors: [
      `Date evidence: ${dateScore >= 18 ? 'present' : 'missing or sparse'}`,
      `Source coverage: ${context.sourceFiles?.length || 0} file layer(s)`,
      `Record density: ${number(context.recordCount)} normalized records`,
      `Spatial anchor: ${context.centroid ? 'centroid available' : 'not supplied'}`,
      `Anomaly signals: ${anomalyHits.length}`,
    ],
  };
}

export function getReconciliationQueues(contexts, editorState = {}) {
  const unreviewed = contexts.filter(context => !editorState[context.id] || editorState[context.id]?.status === 'unreviewed');
  const weakStratigraphy = contexts.filter(context => !context.unit && !context.strat && !context.feature).slice(0, 18);
  const datingGaps = contexts.filter(context => !context.dateRange || context.dateRange[0] === null || context.dateRange[1] === null).slice(0, 18);
  const highValue = contexts.filter(context => context.recordCount > 2000 && (!editorState[context.id] || editorState[context.id]?.status !== 'accepted')).slice(0, 18);
  const sourceIssues = contexts.filter(context => !context.sampleRecords?.some(record => record.uri)).slice(0, 18);
  return [
    {
      id: 'high-value',
      label: 'High-value unreviewed contexts',
      count: highValue.length,
      description: 'Large evidence clusters that should be reviewed before publication exports or graph acceptance.',
      contexts: highValue,
      recommendedStatus: 'needs-field-check',
    },
    {
      id: 'weak-stratigraphy',
      label: 'Weak stratigraphic labels',
      count: weakStratigraphy.length,
      description: 'Contexts missing unit/strat/feature labels. These are risky inputs for a Harris Matrix.',
      contexts: weakStratigraphy,
      recommendedStatus: 'needs-field-check',
    },
    {
      id: 'dating-gaps',
      label: 'Chronology gaps',
      count: datingGaps.length,
      description: 'Contexts without usable start/end dates. Review nearby radiocarbon and context hierarchy before sequencing.',
      contexts: datingGaps,
      recommendedStatus: 'needs-field-check',
    },
    {
      id: 'source-uris',
      label: 'Source URI gaps',
      count: sourceIssues.length,
      description: 'Sample records without direct source links need citation caution or repository lookup.',
      contexts: sourceIssues,
      recommendedStatus: 'unreviewed',
    },
    {
      id: 'unreviewed',
      label: 'Total unreviewed queue',
      count: unreviewed.length,
      description: 'Remaining visible contexts with no accepted local review state.',
      contexts: unreviewed.slice(0, 18),
      recommendedStatus: 'accepted',
    },
  ];
}

export function getMissingLinkCandidates(selectedContext, contexts, reviewState = {}, manualRelationships = []) {
  if (!selectedContext) return [];
  const existing = new Set([
    ...researchData.openContext.relationshipCandidates.map(edge => `${edge.source}->${edge.target}`),
    ...manualRelationships.map(edge => `${edge.source}->${edge.target}`),
  ]);
  return contexts
    .filter(context => context.id !== selectedContext.id)
    .map(context => {
      const sameProject = context.project === selectedContext.project ? 18 : 0;
      const sameSite = context.site === selectedContext.site ? 24 : 0;
      const sameArea = context.area && context.area === selectedContext.area ? 16 : 0;
      const sameUnit = context.unit && context.unit === selectedContext.unit ? 18 : 0;
      const dateGap = Math.abs((context.dateRange?.[0] ?? 999999) - (selectedContext.dateRange?.[1] ?? selectedContext.dateRange?.[0] ?? 0));
      const dateScore = dateGap < 50 ? 18 : dateGap < 250 ? 12 : dateGap < 1000 ? 6 : 0;
      const densityScore = Math.min(12, Math.round(Math.log10((context.recordCount || 0) + 1) * 4));
      const confidenceScore = Math.round(Math.min(context.confidence || 0, selectedContext.confidence || 0) * 0.08);
      const forwardExists = existing.has(`${selectedContext.id}->${context.id}`);
      const reverseExists = existing.has(`${context.id}->${selectedContext.id}`);
      const existingPenalty = forwardExists || reverseExists ? 40 : 0;
      const score = Math.max(0, sameProject + sameSite + sameArea + sameUnit + dateScore + densityScore + confidenceScore - existingPenalty);
      const direction = (selectedContext.dateRange?.[0] ?? 0) <= (context.dateRange?.[0] ?? 0)
        ? `${selectedContext.id} → ${context.id}`
        : `${context.id} → ${selectedContext.id}`;
      return {
        context,
        score,
        confidence: Math.min(0.94, Math.max(0.22, score / 100)),
        direction,
        type: sameUnit ? 'same-unit sequence candidate' : sameArea ? 'same-area bridge candidate' : sameSite ? 'same-site missing link candidate' : 'cross-site comparison candidate',
        rationale: [
          sameSite ? 'same site' : 'different site',
          sameArea ? 'same excavation area' : 'area differs or missing',
          sameUnit ? 'same unit label' : 'unit differs or missing',
          dateScore ? 'date ranges are close enough to inspect' : 'date ranges are distant or incomplete',
        ].join('; '),
      };
    })
    .filter(item => item.score > 18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 14);
}

function seededRandom(seedText = 'astraea') {
  let seed = 2166136261;
  String(seedText).split('').forEach(char => {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  });
  return function random() {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalSample(random) {
  const u = Math.max(1e-12, random());
  const v = Math.max(1e-12, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function logNormalDensity(value, mean, sigma) {
  const safeSigma = Math.max(1, sigma || 1);
  const z = (value - mean) / safeSigma;
  return -0.5 * z * z - Math.log(safeSigma * Math.sqrt(2 * Math.PI));
}

function logMeanExp(values) {
  if (!values.length) return 0;
  const max = Math.max(...values);
  return max + Math.log(values.reduce((sum, value) => sum + Math.exp(value - max), 0) / values.length);
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

const chronologyModelCache = new Map();
const multiChronologyModelCache = new Map();

function runCurveCalibratedMcmc({ context, related, rcCenter, iterations = 3200, burnIn = 700, thin = 2 }) {
  const contextStart = context.dateRange?.[0];
  const contextEnd = context.dateRange?.[1];
  const contextCenter = contextStart !== null && contextEnd !== null && contextStart !== undefined && contextEnd !== undefined
    ? (contextStart + contextEnd) / 2
    : null;
  const calibrationInputs = related
    .filter(record => Number.isFinite(record.normalizedAge ?? record.measuredAge))
    .map(record => ({
      labNumber: record.labNumber,
      observedAge: record.normalizedAge ?? record.measuredAge,
      observedSigma: record.normalizedSigma ?? record.measuredSigma ?? 80,
      curveId: chooseCalibrationCurve(record).id,
      curveLabel: chooseCalibrationCurve(record).label,
      material: record.material || 'unknown material',
      qualityFlags: record.qualityFlags || [],
      siteName: record.siteName,
      stratigraphicUnit: record.stratigraphicUnit,
    }));
  const anchorCenter = contextCenter ?? rcCenter ?? 0;
  const contextSigma = contextCenter !== null
    ? Math.max(80, Math.abs((contextEnd ?? contextCenter) - (contextStart ?? contextCenter)) / 3.2)
    : 1400;
  const proposalSigma = Math.max(35, Math.min(520, contextSigma * 0.38));
  const random = seededRandom(`${context.id}-${calibrationInputs.map(item => item.labNumber).join('|')}`);

  function logPosterior(year) {
    const prior = logNormalDensity(year, anchorCenter, contextSigma);
    if (!calibrationInputs.length) return prior;
    const likelihoods = related.map(record => {
      const calibration = calibrateRadiocarbonSample(record, year);
      if (!calibration) return -Infinity;
      const flags = record.qualityFlags || [];
      const qualityPenalty = flags.length ? -0.18 * flags.length : 0;
      return logNormalDensity(calibration.observedAge, calibration.curvePoint.radiocarbonAge, calibration.totalSigma) + qualityPenalty;
    });
    return prior + logMeanExp(likelihoods);
  }

  const chain = [];
  let current = anchorCenter + normalSample(random) * Math.max(20, contextSigma * 0.2);
  let currentLog = logPosterior(current);
  let accepted = 0;
  for (let step = 0; step < iterations; step += 1) {
    const proposal = current + normalSample(random) * proposalSigma;
    const proposalLog = logPosterior(proposal);
    if (Math.log(Math.max(1e-12, random())) < proposalLog - currentLog) {
      current = proposal;
      currentLog = proposalLog;
      accepted += 1;
    }
    if (step >= burnIn && (step - burnIn) % thin === 0) {
      chain.push(current);
    }
  }

  const lowPlot = quantile(chain, 0.005);
  const highPlot = quantile(chain, 0.995);
  const span = Math.max(1, highPlot - lowPlot);
  const binCount = 80;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    year: lowPlot + (index / (binCount - 1)) * span,
    density: 0,
  }));
  chain.forEach(sample => {
    const index = Math.max(0, Math.min(binCount - 1, Math.floor(((sample - lowPlot) / span) * binCount)));
    bins[index].density += 1;
  });
  const maxDensity = Math.max(...bins.map(bin => bin.density), 1);
  const points = bins.map(bin => ({ ...bin, density: bin.density / maxDensity }));

  return {
    samples: chain,
    points,
    calibrationInputs,
    posterior: {
      center: quantile(chain, 0.5),
      mean: chain.reduce((sum, sample) => sum + sample, 0) / Math.max(1, chain.length),
      low68: quantile(chain, 0.16),
      high68: quantile(chain, 0.84),
      low95: quantile(chain, 0.025),
      high95: quantile(chain, 0.975),
      spread: (quantile(chain, 0.84) - quantile(chain, 0.16)) / 2,
    },
    diagnostics: {
      iterations,
      burnIn,
      thin,
      retainedSamples: chain.length,
      acceptanceRate: accepted / iterations,
      proposalSigma,
    },
  };
}

export function getChronologyPropagationModel(selectedContext) {
  const context = selectedContext || researchData.openContext.contexts[0];
  const siteName = String(context.site || '').toLowerCase();
  const related = researchData.radiocarbon.records
    .filter(record => record.normalizedAge !== null)
    .filter(record => siteName && String(record.siteName || '').toLowerCase().includes(siteName))
    .slice(0, 16);
  const matchMode = related.length ? 'site-related radiocarbon samples' : 'no direct radiocarbon match for selected context';
  const bands = related.map(record => record.calibratedBand).filter(Boolean);
  const centers = bands.map(band => band.centerYear).filter(value => value !== null && value !== undefined);
  const contextStart = context.dateRange?.[0];
  const contextEnd = context.dateRange?.[1];
  const contextCenter = contextStart !== null && contextEnd !== null && contextStart !== undefined && contextEnd !== undefined
    ? (contextStart + contextEnd) / 2
    : null;
  const rcCenter = centers.length ? centers.reduce((sum, value) => sum + value, 0) / centers.length : null;
  const cacheKey = [
    context.id,
    contextStart,
    contextEnd,
    related.map(record => `${record.labNumber}:${record.normalizedAge ?? record.measuredAge}:${record.normalizedSigma ?? record.measuredSigma}`).join('|'),
  ].join('::');
  if (chronologyModelCache.has(cacheKey)) return chronologyModelCache.get(cacheKey);
  const mcmc = runCurveCalibratedMcmc({ context, related, rcCenter });
  const model = {
    context,
    related,
    inputs: {
      contextRange: context.dateRange || [null, null],
      contextCenter,
      radiocarbonCenter: rcCenter,
      radiocarbonCenters: centers,
      radiocarbonCount: related.length,
      matchMode,
      calibrationInputs: mcmc.calibrationInputs,
    },
    posterior: mcmc.posterior,
    points: mcmc.points,
    samples: mcmc.samples,
    diagnostics: mcmc.diagnostics,
    caveat: related.length
      ? 'Curve-based MCMC sampler: each proposed calendar year is evaluated against IntCal20, SHCal20, or Marine20 through interpolated radiocarbon-age likelihoods.'
      : 'No direct radiocarbon samples matched this selected context, so the sampler uses the context date prior only. Select a context/site with 14C data to activate curve-based likelihoods.',
  };
  chronologyModelCache.set(cacheKey, model);
  return model;
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function relatedRadiocarbonForContext(context) {
  const contextText = normalizeForMatch([
    context.project,
    context.site,
    context.area,
    context.unit,
    context.strat,
    context.feature,
    context.contextPath?.join(' '),
  ].join(' '));
  const tokens = new Set(contextText.split(/\s+/).filter(token => token.length >= 5));
  return researchData.radiocarbon.records
    .filter(record => Number.isFinite(record.normalizedAge ?? record.measuredAge))
    .map(record => {
      const recordText = normalizeForMatch([
        record.siteName,
        record.excavationUnit,
        record.stratigraphicUnit,
        record.feature,
        record.region,
      ].join(' '));
      const directSite = normalizeForMatch(record.siteName);
      const tokenHits = recordText.split(/\s+/).filter(token => tokens.has(token)).length;
      const score = (directSite && contextText.includes(directSite) ? 8 : 0)
        + tokenHits
        + (record.excavationUnit && contextText.includes(normalizeForMatch(record.excavationUnit)) ? 3 : 0)
        + (record.stratigraphicUnit && contextText.includes(normalizeForMatch(record.stratigraphicUnit)) ? 3 : 0);
      return { record, score };
    })
    .filter(item => item.score >= 4)
    .sort((a, b) => b.score - a.score)
    .map(item => item.record)
    .slice(0, 10);
}

function summarizeRadiocarbonSite(siteName, records) {
  const centers = records
    .map(record => record.calibratedBand?.centerYear)
    .filter(value => value !== null && value !== undefined);
  const low = centers.length ? Math.min(...centers) - 160 : null;
  const high = centers.length ? Math.max(...centers) + 160 : null;
  return {
    id: `RC-${siteName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    project: 'Radiocarbon Site Cluster',
    site: siteName,
    area: '14C sample group',
    unit: '',
    strat: '',
    feature: '',
    contextPath: ['Radiocarbon', siteName],
    recordCount: records.length,
    dateRange: low !== null && high !== null ? [low, high] : [null, null],
    sourceDataset: 'Oaxaca radiocarbon workbook',
    sourceFiles: ['Oaxaca-All-14C-Samples-Original.xlsx'],
    confidence: records.length >= 12 ? 88 : records.length >= 5 ? 78 : 66,
  };
}

function chronologyTrackFromContext(context, related, kind, options = {}) {
  const bands = related.map(record => record.calibratedBand).filter(Boolean);
  const centers = bands.map(band => band.centerYear).filter(value => value !== null && value !== undefined);
  const rcCenter = centers.length ? centers.reduce((sum, value) => sum + value, 0) / centers.length : null;
  const mcmc = runCurveCalibratedMcmc({
    context,
    related,
    rcCenter,
    iterations: options.iterations || 1400,
    burnIn: options.burnIn || 300,
    thin: options.thin || 2,
  });
  const span = Math.max(1, mcmc.posterior.high95 - mcmc.posterior.low95);
  return {
    id: context.id,
    kind,
    context,
    related,
    points: mcmc.points,
    posterior: mcmc.posterior,
    diagnostics: mcmc.diagnostics,
    calibrationInputs: mcmc.calibrationInputs,
    supportLevel: related.length ? 'curve-calibrated 14C likelihood' : 'context-prior only',
    uncertaintyScore: Math.round(Math.min(100, span / 40)),
    label: kind === 'radiocarbon-site' ? context.site : contextLabel(context),
  };
}

export function getMultiContextChronologyModel(contexts = [], selectedContext = null) {
  const visible = (contexts.length ? contexts : researchData.openContext.contexts)
    .filter(context => context.dateRange?.[0] !== null && context.dateRange?.[1] !== null)
    .sort((a, b) => (b.recordCount || 0) - (a.recordCount || 0))
    .slice(0, 18);
  const selected = selectedContext && selectedContext.dateRange?.[0] !== null ? [selectedContext] : [];
  const contextCandidates = uniqueBy([...selected, ...visible], context => context.id).slice(0, 18);

  const radiocarbonGroups = new Map();
  researchData.radiocarbon.records
    .filter(record => Number.isFinite(record.normalizedAge ?? record.measuredAge) && record.siteName)
    .forEach(record => {
      if (!radiocarbonGroups.has(record.siteName)) radiocarbonGroups.set(record.siteName, []);
      radiocarbonGroups.get(record.siteName).push(record);
    });
  const radiocarbonSites = Array.from(radiocarbonGroups.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([siteName, records]) => ({ siteName, records: records.slice(0, 14) }));

  const cacheKey = [
    contextCandidates.map(context => `${context.id}:${context.dateRange?.join('-')}`).join('|'),
    radiocarbonSites.map(site => `${site.siteName}:${site.records.length}`).join('|'),
  ].join('::');
  if (multiChronologyModelCache.has(cacheKey)) return multiChronologyModelCache.get(cacheKey);

  const contextTracks = contextCandidates.map(context => chronologyTrackFromContext(
    context,
    relatedRadiocarbonForContext(context),
    'archaeological-context',
    { iterations: 900, burnIn: 180, thin: 2 },
  ));
  const radiocarbonTracks = radiocarbonSites.map(site => chronologyTrackFromContext(
    summarizeRadiocarbonSite(site.siteName, site.records),
    site.records,
    'radiocarbon-site',
    { iterations: 1800, burnIn: 360, thin: 2 },
  ));
  const tracks = [...contextTracks, ...radiocarbonTracks].sort((a, b) => a.posterior.center - b.posterior.center);
  const calibratedTracks = tracks.filter(track => track.related.length);
  const highUncertainty = tracks.filter(track => track.uncertaintyScore >= 75).slice(0, 8);
  const sequenceGaps = tracks.slice(1).map((track, index) => ({
    from: tracks[index],
    to: track,
    gap: track.posterior.low95 - tracks[index].posterior.high95,
  })).filter(item => item.gap > 250).slice(0, 8);

  const model = {
    tracks,
    contextTracks,
    radiocarbonTracks,
    calibratedTracks,
    highUncertainty,
    sequenceGaps,
    stats: {
      totalTracks: tracks.length,
      archaeologicalContexts: contextTracks.length,
      radiocarbonSites: radiocarbonTracks.length,
      curveCalibratedTracks: calibratedTracks.length,
      retainedSamples: tracks.reduce((sum, track) => sum + track.diagnostics.retainedSamples, 0),
    },
    explanation: 'Multi-context chronology model: visible archaeological contexts are modeled as context-prior tracks, while radiocarbon-rich sites run curve-calibrated MCMC likelihoods against IntCal20, SHCal20, or Marine20. The two lanes are shown together so the user can see where archaeological context and absolute dating evidence overlap or diverge.',
  };
  multiChronologyModelCache.set(cacheKey, model);
  return model;
}

export function getEvidenceLayerObjectives({ contexts, selectedContext, editorState = {}, reviewState = {}, anomalyReview = {}, manualRelationships = [] }) {
  const context = selectedContext || contexts[0] || researchData.openContext.contexts[0];
  const reviewedContexts = Object.values(editorState).filter(item => item?.status && item.status !== 'unreviewed').length;
  const graph = getGraphModel(contexts, reviewState, manualRelationships);
  const acceptedEdges = graph.relationships.filter(edge => edge.reviewStatus === 'accepted').length;
  const contextAnomalies = researchData.reports.anomalies.filter(item => item.context === context?.id);
  const resolvedAnomalies = Object.values(anomalyReview).filter(status => status === 'accepted' || status === 'dismissed').length;
  const chronology = getChronologyPropagationModel(context);
  const citationCount = actualCitationRecords.length;
  const phaseModel = inferPhaseModel(contexts, editorState);
  const consistency = stratigraphicConsistencyScore(context, reviewState, anomalyReview);

  return [
    {
      id: 'source',
      title: 'Source Evidence Layer',
      objective: 'Preserve raw provenance so every transformed claim can be traced back to file names, source URIs, citation URIs, and original record fields.',
      status: `${number(researchData.reports.overview.totalOpenContextRows)} source rows`,
      output: 'Auditable source ledger',
      readiness: 94,
    },
    {
      id: 'canonical',
      title: 'Canonical Context Layer',
      objective: 'Normalize messy excavation labels into stable contexts that can carry records, coordinates, dates, materials, notes, and review status.',
      status: `${number(contexts.length)} visible contexts · ${number(reviewedContexts)} locally reviewed`,
      output: 'Canonical context register',
      readiness: Math.min(96, Math.round((reviewedContexts / Math.max(1, contexts.length)) * 100) + 28),
    },
    {
      id: 'relationships',
      title: 'Relationship Layer',
      objective: 'Represent source-derived, inferred, user-created, and machine-suggested stratigraphic relationships as reviewable DAG edges.',
      status: `${number(graph.relationships.length)} visible edges · ${number(acceptedEdges)} accepted`,
      output: 'Provisional Harris Matrix edge table',
      readiness: Math.min(92, 34 + acceptedEdges * 8),
    },
    {
      id: 'chronology',
      title: 'Chronology Layer',
      objective: 'Propagate sparse absolute dates and context ranges into uncertainty bands while keeping contamination and calibration caveats explicit.',
      status: `${number(chronology.related.length)} date drivers for selected context`,
      output: 'Posterior-style layer date model',
      readiness: chronology.related.length ? 76 : 38,
    },
    {
      id: 'anomaly',
      title: 'Anomaly Layer',
      objective: 'Turn taphonomic, recording, source, dating, and relationship irregularities into reviewable research problems.',
      status: `${number(contextAnomalies.length)} selected-context signals · ${number(resolvedAnomalies)} resolved globally`,
      output: 'Anomaly review queue',
      readiness: Math.max(32, 84 - contextAnomalies.length * 9),
    },
    {
      id: 'interpretation',
      title: 'Interpretation Layer',
      objective: 'Store the current human-in-the-loop model: accepted edges, rejected alternatives, anomaly decisions, notes, consistency score, and export readiness.',
      status: `${consistency.score}% selected-context consistency`,
      output: 'Defensible interpretation state',
      readiness: consistency.score,
    },
    {
      id: 'phase',
      title: 'Phase Layer',
      objective: 'Group contexts into archaeological phases that can be named, audited, compared, and exported as historical interpretation units.',
      status: `${number(phaseModel.length)} phase candidates`,
      output: 'Phase model draft',
      readiness: Math.min(88, 46 + phaseModel.filter(phase => phase.contexts.length).length * 8),
    },
    {
      id: 'citation',
      title: 'Citation Layer',
      objective: 'Attach citation text, source URIs, citation URIs, and machine-generated labels to contexts, edges, anomalies, dates, and final claims.',
      status: `${number(citationCount)} dataset-derived citation records`,
      output: 'Citation-safe evidence trail',
      readiness: citationCount ? 91 : 20,
    },
  ];
}

export function inferPhaseModel(contexts, editorState = {}) {
  const dated = contexts.filter(context => context.dateRange?.[0] !== null && context.dateRange?.[1] !== null);
  const starts = dated.map(context => context.dateRange[0]);
  const min = starts.length ? Math.min(...starts) : -7000;
  const max = starts.length ? Math.max(...starts) : 1000;
  const span = Math.max(1, max - min);
  const phaseDefs = [
    { id: 'phase-1', name: 'Earliest Depositional Activity', low: min, high: min + span * 0.25 },
    { id: 'phase-2', name: 'Primary Occupation / Accumulation', low: min + span * 0.25, high: min + span * 0.5 },
    { id: 'phase-3', name: 'Intensive Use / Reworking', low: min + span * 0.5, high: min + span * 0.75 },
    { id: 'phase-4', name: 'Late Use / Sealing Episodes', low: min + span * 0.75, high: max + 1 },
    { id: 'phase-5', name: 'Uncertain or Undated Contexts', low: null, high: null },
  ];

  return phaseDefs.map(phase => {
    const phaseContexts = phase.low === null
      ? contexts.filter(context => !context.dateRange || context.dateRange[0] === null || context.dateRange[1] === null)
      : contexts.filter(context => {
        const start = context.dateRange?.[0];
        return start !== null && start !== undefined && start >= phase.low && start < phase.high;
      });
    const reviewed = phaseContexts.filter(context => editorState[context.id]?.status && editorState[context.id].status !== 'unreviewed').length;
    return {
      ...phase,
      contexts: phaseContexts.slice(0, 18),
      total: phaseContexts.length,
      reviewed,
      range: phase.low === null ? 'undated' : `${formatYear(phase.low)} – ${formatYear(phase.high)}`,
      objective: phase.low === null
        ? 'Resolve missing dates or keep these contexts outside the phase model with explicit uncertainty.'
        : 'Audit whether contexts in this interval belong together as a coherent archaeological phase.',
    };
  });
}

export function buildEvidenceObject({ selectedContext, reviewState = {}, anomalyReview = {}, manualRelationships = [], editorState = {} }) {
  const context = selectedContext || researchData.openContext.contexts[0];
  const graphEdges = getGraphModel([context, ...researchData.openContext.contexts.filter(item => item.site === context.site).slice(0, 40)], reviewState, manualRelationships)
    .relationships
    .filter(edge => edge.source === context.id || edge.target === context.id)
    .slice(0, 12);
  const chronology = getChronologyPropagationModel(context);
  const anomalies = researchData.reports.anomalies.filter(item => item.context === context.id).slice(0, 12);
  const score = stratigraphicConsistencyScore(context, reviewState, anomalyReview);
  const citations = [
    ...context.sampleRecords?.filter(record => record.uri).slice(0, 6).map(record => ({
      label: record.label,
      uri: record.uri,
      citation: `Source record for ${record.label}`,
    })) || [],
    ...actualCitationRecords.slice(0, 4),
  ];
  const inferredPhases = inferPhaseModel([context], editorState);
  const phase = inferredPhases.find(item => item.contexts.some(phaseContext => phaseContext.id === context.id)) || inferredPhases[inferredPhases.length - 1];

  return {
    id: `EVIDENCE-${context.id}`,
    objective: 'Transform raw archaeological rows into a citation-safe interpretive claim about one context.',
    rawSourceEvidence: {
      files: context.sourceFiles || [],
      sampleRecords: context.sampleRecords || [],
      sourceDataset: context.sourceDataset,
    },
    canonicalContext: {
      id: context.id,
      label: contextLabel(context),
      aliases: context.contextPath || [],
      recordCount: context.recordCount,
      coordinates: context.centroid,
      reviewState: editorState[context.id] || { status: 'unreviewed', note: '' },
    },
    relationshipLayer: graphEdges,
    chronologyLayer: chronology.posterior,
    anomalyLayer: anomalies,
    interpretationLayer: {
      consistencyScore: score.score,
      level: score.level,
      factors: score.factors,
    },
    phaseLayer: {
      id: phase?.id,
      name: phase?.name,
      range: phase?.range,
    },
    citationLayer: citations,
    claim: `${context.id} is modelled as ${contextLabel(context)} with ${number(context.recordCount)} source-linked records, ${score.score}% stratigraphic consistency, and ${graphEdges.length} visible relationship candidates.`,
  };
}

function topPairs(mapLike, limit = 4) {
  const counts = new Map();
  mapLike.forEach(items => {
    items?.forEach(([name, count]) => counts.set(name, (counts.get(name) || 0) + count));
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function buildPastReconstruction({
  contexts,
  selectedContext,
  modelType = 'reconciled',
  lens = 'stratigraphy',
  reviewState = {},
  anomalyReview = {},
  manualRelationships = [],
  editorState = {},
} = {}) {
  const anchor = selectedContext || contexts[0] || researchData.openContext.contexts[0];
  const siteContexts = contexts.filter(context => context.site === anchor.site).slice(0, 80);
  const workingContexts = siteContexts.length >= 6 ? siteContexts : contexts.slice(0, 80);
  const graph = getGraphModel(workingContexts, reviewState, manualRelationships);
  const phases = inferPhaseModel(workingContexts, editorState).filter(phase => phase.total);
  const anomalySet = researchData.reports.anomalies.filter(item => workingContexts.some(context => context.id === item.context));
  const acceptedEdges = graph.relationships.filter(edge => edge.reviewStatus === 'accepted').length;
  const rejectedEdges = graph.relationships.filter(edge => edge.reviewStatus === 'rejected').length;
  const sourceUriCoverage = workingContexts.filter(context => context.sampleRecords?.some(record => record.uri)).length / Math.max(1, workingContexts.length);
  const dateCoverage = workingContexts.filter(context => context.dateRange?.[0] !== null && context.dateRange?.[1] !== null).length / Math.max(1, workingContexts.length);
  const anomalyBurden = Math.min(1, anomalySet.length / Math.max(1, workingContexts.length * 1.5));
  const reviewCoverage = Object.keys(editorState).filter(id => workingContexts.some(context => context.id === id)).length / Math.max(1, workingContexts.length);
  const modelWeights = {
    conservative: { graph: 0.14, anomaly: 0.2, source: 0.34, date: 0.24, review: 0.08 },
    reconciled: { graph: 0.3, anomaly: 0.16, source: 0.22, date: 0.2, review: 0.12 },
    disturbance: { graph: 0.18, anomaly: 0.34, source: 0.2, date: 0.18, review: 0.1 },
  };
  const weights = modelWeights[modelType] || modelWeights.reconciled;
  const graphStrength = Math.min(1, (acceptedEdges + graph.relationships.length * 0.16) / Math.max(1, workingContexts.length));
  const confidence = Math.round(
    (sourceUriCoverage * weights.source
      + dateCoverage * weights.date
      + graphStrength * weights.graph
      + (1 - anomalyBurden) * weights.anomaly
      + reviewCoverage * weights.review) * 100,
  );
  const materials = topPairs(workingContexts.map(context => context.materials), 5);
  const taxa = topPairs(workingContexts.map(context => context.taxa), 5);
  const chronology = getChronologyPropagationModel(anchor);
  const contradictions = [
    ...(anomalySet.length ? [{ type: 'Anomaly burden', severity: Math.min(95, 32 + anomalySet.length * 3), text: `${anomalySet.length} taphonomic or recording signals affect this reconstruction scope.` }] : []),
    ...(rejectedEdges ? [{ type: 'Rejected relationships', severity: Math.min(90, 42 + rejectedEdges * 8), text: `${rejectedEdges} provisional relationship(s) have been rejected and should not drive the final sequence.` }] : []),
    ...(sourceUriCoverage < 0.55 ? [{ type: 'Citation coverage', severity: 68, text: 'Several contexts lack direct sample source URIs; source lookup is needed before publication.' }] : []),
    ...(dateCoverage < 0.7 ? [{ type: 'Chronology coverage', severity: 72, text: 'Some contexts lack usable date ranges, weakening sequence reconstruction confidence.' }] : []),
  ].sort((a, b) => b.severity - a.severity);

  const modelTitle = {
    conservative: 'Conservative Past',
    reconciled: 'Reconciled Past',
    disturbance: 'Disturbance-Aware Past',
  }[modelType] || 'Reconciled Past';

  const lensNarratives = {
    stratigraphy: `The ${modelTitle} treats ${number(workingContexts.length)} contexts as a depositional sequence with ${number(graph.relationships.length)} visible relationship candidates. The strongest claim is that recurring site/area groupings can be organized into ${number(phases.length)} phase bands, but every inferred edge remains reviewable.`,
    chronology: `Chronology is anchored by ${number(chronology.related.length)} radiocarbon driver(s) and context date ranges around ${formatRange(anchor.dateRange)}. The current posterior-style model centers near ${formatYear(chronology.posterior.center)} with a deliberately visible uncertainty band.`,
    materials: `Material evidence is dominated by ${materials.map(([name, count]) => `${name} (${number(count)})`).join(', ') || 'unclassified evidence'}. Taxonomic signals include ${taxa.map(([name, count]) => `${name} (${number(count)})`).join(', ') || 'no dominant taxa in the visible set'}.`,
    anomaly: `The disturbance lens highlights ${number(anomalySet.length)} anomaly signal(s). In this mode, taphonomic notes, uncertain relationships, and suspicious recording patterns reduce confidence rather than being hidden behind the graph.`,
    citation: `The citation lens checks whether interpretation claims can point back to source records. Current source URI coverage is ${Math.round(sourceUriCoverage * 100)}%, and Astraea keeps machine suggestions separate from source evidence.`,
  };

  const cards = [
    {
      id: 'sequence',
      title: 'Likely Depositional Sequence',
      claim: phases.length
        ? `The visible evidence supports a ${phases.length}-phase depositional model beginning with ${phases[0].name.toLowerCase()} and ending with ${phases[phases.length - 1].name.toLowerCase()}.`
        : 'The visible evidence is not yet sufficient to build a stable phase sequence.',
      evidenceFor: [`${number(graph.relationships.length)} relationship candidates`, `${number(workingContexts.length)} normalized contexts`, `${Math.round(dateCoverage * 100)}% date coverage`],
      evidenceAgainst: contradictions.slice(0, 2).map(item => item.text),
      action: 'Open the Harris Matrix and accept only relationships with source support.',
      confidence: Math.max(12, Math.min(94, confidence + (modelType === 'conservative' ? 4 : 0))),
    },
    {
      id: 'disturbance',
      title: 'Disturbance / Contamination Risk',
      claim: anomalySet.length
        ? 'Some contexts may contain disturbance, taphonomic mixing, or recording uncertainty that can distort the reconstructed sequence.'
        : 'No major anomaly burden is visible for this reconstruction scope.',
      evidenceFor: anomalySet.slice(0, 3).map(item => item.evidence),
      evidenceAgainst: ['Signals are triage prompts, not automatic interpretation changes.'],
      action: 'Review anomaly cards and decide whether each one affects the sequence.',
      confidence: Math.max(18, Math.min(92, Math.round(anomalyBurden * 100))),
    },
    {
      id: 'chronology',
      title: 'Date-Controlled Past State',
      claim: `The selected context is modeled near ${formatYear(chronology.posterior.center)}, but the uncertainty band remains broad enough to require caution.`,
      evidenceFor: chronology.related.slice(0, 3).map(record => `${record.labNumber || 'sample'} · ${record.siteName || 'unknown site'} · ${record.material || 'unknown material'}`),
      evidenceAgainst: ['Curve choice and reservoir effects still require expert review, especially for shell, marine, or uncertain materials.'],
      action: 'Use the chronology workbench to inspect MCMC diagnostics, credible intervals, and radiocarbon inputs before treating the date as stable.',
      confidence: Math.round(dateCoverage * 100),
    },
    {
      id: 'publication',
      title: 'Publication Readiness',
      claim: confidence >= 78
        ? 'This reconstruction is approaching publication-ready status if its major claims are supported by citations.'
        : 'This reconstruction is promising, but it still needs more review before it can be treated as a defensible interpretation.',
      evidenceFor: [`${Math.round(sourceUriCoverage * 100)}% source URI coverage`, `${number(acceptedEdges)} accepted edge(s)`, `${number(Object.keys(editorState).length)} local review decision(s)`],
      evidenceAgainst: contradictions.map(item => item.text).slice(0, 3),
      action: 'Export the evidence object and publication packet after resolving high-severity contradictions.',
      confidence,
    },
  ];

  const questions = [
    {
      id: 'what-happened',
      label: 'What probably happened here?',
      answer: lensNarratives[lens],
    },
    {
      id: 'strongest',
      label: 'What evidence is strongest?',
      answer: `The strongest evidence is source density: ${number(workingContexts.reduce((sum, context) => sum + context.recordCount, 0))} records across ${number(workingContexts.length)} contexts, with ${Math.round(sourceUriCoverage * 100)}% source-link coverage.`,
    },
    {
      id: 'weakest',
      label: 'What is weakest?',
      answer: contradictions[0]?.text || 'The weakest part is not a contradiction, but the need for human review before treating inferred graph edges as archaeological facts.',
    },
    {
      id: 'change',
      label: 'What would change the interpretation?',
      answer: 'Rejecting key graph edges, marking contexts as contaminated, excluding weak radiocarbon samples, or adding field-note evidence would all change the defensibility score.',
    },
    {
      id: 'publish',
      label: 'Is this publishable?',
      answer: confidence >= 78
        ? 'Potentially, if the accepted edges and chronology assumptions are exported with citations and uncertainty statements.'
        : 'Not yet. Resolve the highest-severity contradictions and improve citation/edge review coverage first.',
    },
  ];

  return {
    anchor,
    modelType,
    modelTitle,
    confidence,
    phases,
    graph,
    anomalySet,
    chronology,
    contradictions,
    cards,
    questions,
    lensNarrative: lensNarratives[lens],
    stats: {
      sourceUriCoverage,
      dateCoverage,
      anomalyBurden,
      reviewCoverage,
      acceptedEdges,
      rejectedEdges,
      contextCount: workingContexts.length,
      materialSummary: materials,
      taxaSummary: taxa,
    },
  };
}

export const defaultHypotheses = [
  {
    id: 'warfare',
    title: 'Abandonment Due To Conflict',
    claim: 'The site or area declined because violence, insecurity, or destruction disrupted occupation.',
    expectedSignals: ['burning', 'destruction', 'weapon', 'trauma', 'rapid abandonment', 'fortification'],
    weakSignals: ['gradual decline', 'continuous occupation', 'domestic refuse stability'],
  },
  {
    id: 'climate',
    title: 'Abandonment Due To Climate Stress',
    claim: 'Environmental pressure reduced carrying capacity and changed settlement behavior.',
    expectedSignals: ['charcoal shift', 'drought', 'pollen', 'sediment', 'erosion', 'faunal change'],
    weakSignals: ['stable subsistence', 'unchanged material profile', 'no chronology break'],
  },
  {
    id: 'economy',
    title: 'Abandonment Due To Economic Reorganization',
    claim: 'Exchange, production, or household economy changed enough to alter occupation intensity.',
    expectedSignals: ['artifact decline', 'import drop', 'workshop change', 'storage change', 'trade disruption'],
    weakSignals: ['consistent artifact density', 'no material shift', 'stable source distribution'],
  },
];

export function scoreHypotheses(hypotheses = defaultHypotheses, contexts = [], anomalyReview = {}, notebookPins = []) {
  const anomalyText = researchData.reports.anomalies
    .filter(item => contexts.some(context => context.id === item.context))
    .map(item => `${item.type} ${item.evidence} ${item.site}`.toLowerCase());
  const contextText = contexts.map(context => [
    context.site,
    context.area,
    context.unit,
    context.strat,
    context.feature,
    context.depositionalContext,
    ...(context.notes || []),
    ...(context.materials || []).map(([name]) => name),
    ...(context.taxa || []).map(([name]) => name),
  ].join(' ').toLowerCase());
  const haystack = [...anomalyText, ...contextText, ...notebookPins.map(pin => JSON.stringify(pin).toLowerCase())];
  const resolvedCount = Object.values(anomalyReview).filter(status => status === 'accepted' || status === 'dismissed').length;

  return hypotheses.map(hypothesis => {
    const support = hypothesis.expectedSignals.flatMap(signal => haystack
      .filter(text => text.includes(signal.toLowerCase()))
      .slice(0, 5)
      .map(text => ({ signal, text: text.slice(0, 160) })));
    const contradictions = hypothesis.weakSignals.flatMap(signal => haystack
      .filter(text => text.includes(signal.toLowerCase()))
      .slice(0, 3)
      .map(text => ({ signal, text: text.slice(0, 160) })));
    const contextCoverage = contexts.length ? Math.min(20, contexts.length / 4) : 0;
    const supportScore = Math.min(55, support.length * 9);
    const contradictionPenalty = Math.min(28, contradictions.length * 7);
    const reviewBoost = Math.min(12, resolvedCount * 1.5);
    const score = Math.max(5, Math.min(96, Math.round(22 + contextCoverage + supportScore + reviewBoost - contradictionPenalty)));
    return {
      ...hypothesis,
      score,
      support,
      contradictions,
      nextTest: support.length
        ? `Inspect ${support[0].signal} evidence and attach or reject it from the notebook.`
        : `Search source notes, anomaly text, and artifact summaries for ${hypothesis.expectedSignals.slice(0, 3).join(', ')}.`,
    };
  }).sort((a, b) => b.score - a.score);
}

export function discoverResearchGaps(contexts = [], editorState = {}, reviewState = {}) {
  const gaps = [];
  const undated = contexts.filter(context => !context.dateRange || context.dateRange[0] === null || context.dateRange[1] === null);
  const weakLabels = contexts.filter(context => !context.unit && !context.strat && !context.feature);
  const noCoordinates = contexts.filter(context => !context.centroid);
  const noUris = contexts.filter(context => !context.sampleRecords?.some(record => record.uri));
  const highDensityUnreviewed = contexts.filter(context => context.recordCount > 2000 && (!editorState[context.id] || editorState[context.id].status === 'unreviewed'));
  const rejectedEdges = Object.values(reviewState).filter(status => status === 'rejected').length;

  [
    ['Chronology sampling gap', undated, 'Add or associate radiocarbon, diagnostic artifact, or phase evidence before relying on this part of the sequence.'],
    ['Weak stratigraphic labelling', weakLabels, 'Resolve unit/stratum/feature labels so these contexts can participate safely in the Harris Matrix.'],
    ['Spatial uncertainty', noCoordinates, 'Add coordinates, trench plans, or photogrammetry references to make spatial reasoning possible.'],
    ['Citation/source gap', noUris, 'Find source URIs or repository citations before using these records in publication claims.'],
    ['High-density unreviewed evidence', highDensityUnreviewed, 'Review these large evidence clusters first; they can dominate interpretation scores.'],
  ].forEach(([title, list, action]) => {
    if (list.length) {
      gaps.push({
        title,
        count: list.length,
        severity: Math.min(98, 35 + list.length * 4),
        action,
        contexts: list.slice(0, 10),
      });
    }
  });

  if (rejectedEdges) {
    gaps.push({
      title: 'Graph contradiction debt',
      count: rejectedEdges,
      severity: Math.min(96, 45 + rejectedEdges * 8),
      action: 'Review rejected relationships and look for alternative edges or phase assignments.',
      contexts: contexts.slice(0, 8),
    });
  }

  return gaps.sort((a, b) => b.severity - a.severity);
}

export function buildAnomalyInvestigation(anomaly, contexts = []) {
  const selected = anomaly || researchData.reports.anomalies[0];
  const context = researchData.openContext.contexts.find(item => item.id === selected?.context)
    || contexts.find(item => item.id === selected?.context)
    || contexts[0]
    || researchData.openContext.contexts[0];
  const related = researchData.reports.anomalies
    .filter(item => item.context === context.id || item.site === selected?.site)
    .slice(0, 12);
  const chronology = getChronologyPropagationModel(context);
  const edges = getGraphModel([context, ...contexts.filter(item => item.site === context.site).slice(0, 30)])
    .relationships
    .filter(edge => edge.source === context.id || edge.target === context.id)
    .slice(0, 8);
  const explanations = [
    {
      title: 'Intrusive or mixed deposit',
      likelihood: selected?.evidence?.toLowerCase().match(/root|fit|disturb|mix|intrus/) ? 82 : 54,
      test: 'Check field notes for disturbance language, refits, roots, burrows, or interface ambiguity.',
    },
    {
      title: 'Recording / classification inconsistency',
      likelihood: selected?.evidence?.toLowerCase().match(/uncertain|possibly|not sure|do not/) ? 76 : 48,
      test: 'Compare source labels, category fields, and sample notes for disagreement.',
    },
    {
      title: 'Legitimate activity change',
      likelihood: Math.max(28, Math.min(72, Math.round((context.recordCount || 1) / 180))),
      test: 'Compare artifact/taxa signature against nearby contexts and phase model.',
    },
  ].sort((a, b) => b.likelihood - a.likelihood);

  return {
    anomaly: selected,
    context,
    related,
    chronology,
    edges,
    explanations,
    researchQuestion: `Why does ${selected?.record || context.id} behave strangely in ${contextLabel(context)}?`,
  };
}

export function discoverCrossSitePatterns(anchorContext, contexts = []) {
  const anchor = anchorContext || contexts[0] || researchData.openContext.contexts[0];
  const anchorTaxa = new Set((anchor.taxa || []).slice(0, 8).map(([name]) => name));
  const anchorMaterials = new Set((anchor.materials || []).slice(0, 8).map(([name]) => name));
  return researchData.openContext.contexts
    .filter(context => context.id !== anchor.id)
    .map(context => {
      const taxaOverlap = (context.taxa || []).filter(([name]) => anchorTaxa.has(name)).length;
      const materialOverlap = (context.materials || []).filter(([name]) => anchorMaterials.has(name)).length;
      const dateGap = Math.abs((context.dateRange?.[0] ?? 999999) - (anchor.dateRange?.[0] ?? 0));
      const dateScore = dateGap < 100 ? 24 : dateGap < 500 ? 16 : dateGap < 1500 ? 8 : 0;
      const sourceScore = context.sourceDataset === anchor.sourceDataset ? 12 : 0;
      const score = Math.min(98, taxaOverlap * 13 + materialOverlap * 11 + dateScore + sourceScore + Math.min(18, Math.log10(context.recordCount + 1) * 4));
      return {
        context,
        score: Math.round(score),
        reasons: [
          taxaOverlap ? `${taxaOverlap} taxa overlap` : '',
          materialOverlap ? `${materialOverlap} material overlap` : '',
          dateScore ? 'chronology proximity' : '',
          sourceScore ? 'same source dataset' : '',
        ].filter(Boolean),
      };
    })
    .filter(item => item.score > 22)
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);
}

function pickRotating(list, index, fallback = null) {
  if (!list?.length) return fallback;
  return list[Math.abs(index) % list.length];
}

function compactSignature(context) {
  const taxa = (context?.taxa || []).slice(0, 4).map(([name, count]) => `${name} (${number(count)})`);
  const materials = (context?.materials || []).slice(0, 3).map(([name, count]) => `${name} (${number(count)})`);
  const samples = (context?.sampleRecords || []).slice(0, 3).map(record => record.label || record.uri).filter(Boolean);
  return {
    taxa,
    materials,
    samples,
    sourceFiles: context?.sourceFiles?.slice(0, 3) || [],
  };
}

function distinctContextLabel(anchor, comparison) {
  const label = contextLabel(comparison);
  return label === contextLabel(anchor) ? `${label} (${comparison.id})` : label;
}

function clampScore(value, min = 8, max = 96) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function anomalyLanguage(evidence = '') {
  const text = String(evidence).toLowerCase();
  return {
    disturbance: /disturb|mix|intrus|root|burrow|bioturb|contamin|redeposit|erosion|wash/.test(text),
    uncertainty: /uncertain|possibly|probabl|maybe|not sure|ambiguous|unknown|question/.test(text),
    material: /ceramic|pottery|lithic|bone|shell|coin|metal|charcoal|glass|slag|plaster/.test(text),
    chronology: /date|late|early|modern|bronze|iron|roman|medieval|radiocarbon|14c/.test(text),
  };
}

function buildRivalInterpretations({
  type,
  caseContext,
  anomaly,
  topGap,
  topLink,
  topCross,
  chronology,
  consistency,
  signature,
  weakContext,
}) {
  const contextName = contextLabel(caseContext);
  const dateWindow = formatRange(caseContext.dateRange);
  const anomalyText = anomaly?.evidence || 'the flagged evidence pattern';
  const language = anomalyLanguage(anomalyText);
  const materialClue = signature.materials[0] || signature.taxa[0] || 'the dominant evidence cluster';
  const comparisonName = topCross?.context ? distinctContextLabel(caseContext, topCross.context) : '';
  const sparseTaxa = !signature.taxa.length;
  const sparseMaterial = !signature.materials.length;
  const directDates = chronology?.inputs?.radiocarbonCount || 0;
  const chronologySpan = chronology?.posterior
    ? `${formatYear(chronology.posterior.low95)} to ${formatYear(chronology.posterior.high95)}`
    : 'an unresolved date range';

  if (type === 'Anomaly Case') {
    return [
      {
        title: language.disturbance ? 'Later disturbance entered an older deposit' : 'Post-depositional mixing changed the layer',
        score: clampScore((anomaly?.severity || 48) + (language.disturbance ? 24 : 6) + (language.chronology ? 8 : 0)),
        claim: `${contextName} may not represent one clean ancient event. The anomaly says "${anomalyText}", which points to material movement, boundary disturbance, or later intrusion into a deposit dated ${dateWindow}. Under this theory, the most suspicious clue is not the size of the context but the mismatch between the layer's expected sequence and the disruptive signal inside it.`,
        evidence: [
          `Anomaly wording: ${anomalyText}`,
          `Working chronology: ${dateWindow}`,
          `Current consistency score: ${consistency.score}%`,
        ],
        nextTest: 'Inspect section notes, sediment descriptions, refits, roots, cuts, and adjacent layers before accepting this context as a single event.',
      },
      {
        title: language.material ? 'Real activity change produced an unusual assemblage' : 'A short-lived behavior episode created the anomaly',
        score: clampScore(42 + Math.log10((caseContext.recordCount || 1) + 1) * 10 + (language.material ? 10 : 0)),
        claim: `The anomaly could be historically meaningful rather than accidental. If ${materialClue} belongs to a focused activity zone, then the odd signal may record a workshop episode, disposal pulse, maintenance event, collapse cleanup, or brief change in how people used this part of the site. This reading treats the layer as unusual because behavior changed, not because the record failed.`,
        evidence: [
          `${number(caseContext.recordCount)} normalized records in this context`,
          `Dominant clue: ${materialClue}`,
          signature.samples.length ? `Sample anchors: ${signature.samples.join('; ')}` : 'Sample anchors are still thin',
        ],
        nextTest: 'Compare the same material class in contexts immediately above, below, and nearby; a repeated pattern supports behavior, while isolation supports disturbance.',
      },
      {
        title: language.uncertainty || weakContext ? 'Source-language ambiguity created a false conflict' : 'Data-model compression hid the original field logic',
        score: clampScore(34 + (language.uncertainty ? 20 : 0) + (weakContext ? 18 : 0) + (sparseMaterial ? 8 : 0)),
        claim: `The archaeological pattern may be less contradictory than the normalized record makes it appear. ${contextName} carries labels, source fields, and transformed categories that may compress several field observations into one canonical context. If the source terminology is vague or the unit/stratum labels are weak, Astraea may be seeing a modelling artifact rather than a true archaeological contradiction.`,
        evidence: [
          weakContext ? 'Context has weak unit/stratum/feature labels' : 'Context has usable labels but still needs source verification',
          sparseMaterial ? 'Material signature is sparse in the normalized view' : `Material summary: ${signature.materials.join(', ')}`,
          `Source files: ${signature.sourceFiles.join(', ') || 'source file list unavailable'}`,
        ],
        nextTest: 'Open the original source records and check whether the anomaly survives before using it as historical evidence.',
      },
    ].sort((a, b) => b.score - a.score);
  }

  if (type === 'Research Gap') {
    return [
      {
        title: topGap?.title?.includes('Chronology') ? 'Dating evidence is the limiting factor' : 'Chronology is still the missing constraint',
        score: clampScore(56 + (topGap?.title?.includes('Chronology') ? 22 : 0) - directDates * 2),
        claim: `The weakest part of the interpretation may be time. ${contextName} sits inside ${dateWindow}, but the model needs stronger absolute or diagnostic dating before it can support claims about tempo, sequence, continuity, or abandonment. This theory says the research priority should be chronological control, not more descriptive cataloguing.`,
        evidence: [
          `${directDates} directly related radiocarbon driver(s) for the selected context`,
          `Modelled uncertainty envelope: ${chronologySpan}`,
          `Gap detected: ${topGap?.title || 'chronology or phase uncertainty'}`,
        ],
        nextTest: 'Associate existing samples, add diagnostic artifact dates, or mark this part of the model as phase-level only.',
      },
      {
        title: topGap?.title?.includes('Citation') || topGap?.title?.includes('source') ? 'Provenance weakness is blocking interpretation' : 'Source traceability is the real bottleneck',
        score: clampScore(48 + (topGap?.title?.includes('Citation') || topGap?.title?.includes('source') ? 24 : 0) + (!signature.samples.length ? 10 : 0)),
        claim: `The problem may not be what happened in the past, but whether the app can safely prove where each claim came from. If source URIs, file references, or sample-level citations are missing, then even a plausible interpretation remains fragile. This theory treats the gap as an audit problem: the historical story cannot become persuasive until the evidence trail is repairable.`,
        evidence: [
          signature.samples.length ? `Visible sample/source anchors: ${signature.samples.join('; ')}` : 'No strong sample/source anchors visible in the generated case',
          `Source files: ${signature.sourceFiles.join(', ') || 'not listed on the context'}`,
          `Context scale: ${number(caseContext.recordCount)} rows`,
        ],
        nextTest: 'Prioritize records without source URIs and attach repository citations before strengthening narrative claims.',
      },
      {
        title: topGap?.title?.includes('stratigraphic') || topGap?.title?.includes('Spatial') ? 'The layer needs spatial-stratigraphic cleanup' : 'The evidence needs cleaner archaeological boundaries',
        score: clampScore(44 + (weakContext ? 20 : 0) + (!caseContext.centroid ? 12 : 0)),
        claim: `The research gap may come from fuzzy archaeological boundaries. If coordinates, unit labels, stratigraphic names, or feature descriptions are incomplete, then the same evidence can be grouped in several plausible ways. This theory argues that the next step is not interpretation but boundary-making: define what belongs together before asking what it means historically.`,
        evidence: [
          caseContext.centroid ? 'Centroid is available for spatial reasoning' : 'No centroid is available for this context',
          weakContext ? 'Unit/stratum/feature labels are weak or missing' : 'Core labels exist but still need relationship review',
          `Date signal: ${dateWindow}`,
        ],
        nextTest: 'Clean unit, trench, feature, and coordinate fields; then rerun the Harris Matrix suggestions to see whether the gap persists.',
      },
    ].sort((a, b) => b.score - a.score);
  }

  if (type === 'Harris Matrix Move') {
    return [
      {
        title: topLink ? 'The proposed edge is a real depositional sequence' : 'A hidden sequence relationship exists',
        score: clampScore((topLink?.score || 38) + 12),
        claim: topLink
          ? `${topLink.direction} may represent a true before-and-after relationship. The case for accepting it rests on ${topLink.rationale}, plus the fact that a matrix edge would reduce ambiguity in the local sequence. If accepted, this would turn two separate contexts into an ordered archaeological claim.`
          : `${contextName} may still belong to a sequence that the current data view cannot see. The absence of a strong edge does not mean the context is isolated; it may mean the relevant field-note relationship has not been normalized yet.`,
        evidence: [
          topLink ? `Candidate direction: ${topLink.direction}` : 'No high-confidence edge is currently selected',
          topLink ? `Suggestion rationale: ${topLink.rationale}` : `Context label: ${contextName}`,
          `Date compatibility: ${dateWindow}`,
        ],
        nextTest: 'Check field notes for above/below/cut/fill/sealed language before accepting the edge.',
      },
      {
        title: 'Similarity is a false positive from labels or dates',
        score: clampScore(50 + (weakContext ? 16 : 0) + (topLink ? Math.max(0, 70 - topLink.score) / 2 : 12)),
        claim: `The candidate relationship may look persuasive because the contexts share labels, site fields, broad dates, or source conventions, not because one actually precedes the other. This theory is especially important when excavation metadata is uneven: graph neatness can create confidence that the stratigraphy itself does not support.`,
        evidence: [
          weakContext ? 'The selected context has weak stratigraphic labels' : 'Labels are usable but still transformed from source data',
          `Current context date range: ${dateWindow}`,
          topLink ? `Candidate confidence: ${Math.round((topLink.confidence || 0) * 100)}%` : 'No candidate confidence available',
        ],
        nextTest: 'Reject the edge temporarily and observe whether the phase model still produces the same chronological story.',
      },
      {
        title: 'The relationship is indirect through reworking or interface activity',
        score: clampScore(40 + (language.disturbance ? 18 : 0) + (anomaly ? 8 : 0)),
        claim: `The two contexts may be connected, but not by a simple layer-over-layer sequence. They could share reworked material, an interface, a cut/fill relationship, collapse debris, cleaning activity, or mixed deposits that blur strict order. This interpretation preserves the archaeological connection while refusing to overstate it as a clean DAG edge.`,
        evidence: [
          anomaly ? `Related anomaly clue: ${anomalyText}` : 'No major anomaly clue attached to this move',
          `Dominant clue: ${materialClue}`,
          `Posterior date window: ${chronologySpan}`,
        ],
        nextTest: 'Model the relationship as a provisional or indirect edge until interface evidence confirms the exact stratigraphic direction.',
      },
    ].sort((a, b) => b.score - a.score);
  }

  return [
      {
        title: topCross ? 'Shared practice or regional habit links the contexts' : 'A wider regional pattern may be present',
        score: clampScore((topCross?.score || 38) + 10),
        claim: topCross
          ? `${contextName} and ${comparisonName} may reflect similar practices, routines, or regional material habits. The comparison is driven by ${topCross.reasons.join(', ') || 'a generated evidence resemblance'}, so this theory treats the match as a serious research lead rather than a finished cultural claim.`
          : `${contextName} may still belong to a broader pattern, but the present comparison set does not expose it clearly. This theory keeps the regional question open while demanding better matching evidence.`,
        evidence: [
          topCross ? `Comparison score: ${topCross.score}%` : 'No confident analogue above the current threshold',
          topCross ? `Comparison context: ${comparisonName}` : `Anchor context: ${contextName}`,
          `Primary clue: ${materialClue}`,
        ],
      nextTest: 'Compare variables one by one: material class, taxa/category, date range, source dataset, and spatial position.',
    },
    {
      title: 'The resemblance comes from recording practice, not ancient connection',
      score: clampScore(46 + (topCross?.reasons?.includes('same source dataset') ? 22 : 0) + (sparseTaxa ? 8 : 0)),
      claim: `The cross-site match may be produced by how the data was collected, normalized, or categorized. Two contexts can look similar because the same project vocabulary, spreadsheet structure, or classification habits shaped them. This theory is a guardrail against turning a database resemblance into an unsupported historical connection.`,
      evidence: [
        topCross?.reasons?.includes('same source dataset') ? 'The match includes same-source-dataset influence' : 'Source-dataset influence is not the main visible reason',
        sparseTaxa ? 'Taxa/category signature is sparse, making resemblance easier to overread' : `Taxa/category clue: ${signature.taxa.join(', ')}`,
        `Source files: ${signature.sourceFiles.join(', ') || 'source files unavailable'}`,
      ],
      nextTest: 'Repeat the comparison after excluding source-dataset similarity and see whether the match survives.',
    },
    {
      title: 'Independent site formation produced a convergent pattern',
      score: clampScore(42 + (language.disturbance ? 12 : 0) + (caseContext.recordCount > 1000 ? 8 : 0)),
      claim: `The contexts may resemble each other because similar depositional processes create similar archaeological signatures in different places. Disposal, collapse, erosion, maintenance, animal activity, or recovery bias can produce comparable material profiles without trade, migration, or direct contact. This theory explains resemblance through process rather than connection.`,
      evidence: [
        anomaly ? `Formation-process clue: ${anomalyText}` : 'No single anomaly dominates the comparison',
        `${number(caseContext.recordCount)} records in the anchor context`,
        `Date window: ${dateWindow}`,
      ],
      nextTest: 'Look for repeated formation-process language and compare context types before making a cultural or exchange argument.',
    },
  ].sort((a, b) => b.score - a.score);
}

export function generateAstraeaCaseFiles({
  contexts = [],
  selectedContext,
  reviewState = {},
  anomalyReview = {},
  manualRelationships = [],
  editorState = {},
  seed = 0,
} = {}) {
  const working = contexts.length ? contexts : researchData.openContext.contexts.slice(0, 140);
  const dense = working.filter(context => context.recordCount > 500).sort((a, b) => b.recordCount - a.recordCount);
  const undated = working.filter(context => !context.dateRange || context.dateRange[0] === null || context.dateRange[1] === null);
  const weak = working.filter(context => !context.unit && !context.strat && !context.feature);
  const anomalies = researchData.reports.anomalies
    .filter(item => working.some(context => context.id === item.context))
    .sort((a, b) => (b.severity || 0) - (a.severity || 0));
  const anchor = selectedContext
    || pickRotating(dense, seed)
    || working[0]
    || researchData.openContext.contexts[0];
  const anomaly = pickRotating(anomalies, seed, researchData.reports.anomalies[0]);
  const anomalyContext = researchData.openContext.contexts.find(context => context.id === anomaly?.context) || anchor;
  const targetContext = pickRotating([anomalyContext, anchor, ...dense, ...weak, ...undated].filter(Boolean), seed);
  const graph = getGraphModel(working, reviewState, manualRelationships);
  const gaps = discoverResearchGaps(working, editorState, reviewState);
  const missingLinks = getMissingLinkCandidates(targetContext, working, reviewState, manualRelationships);
  const crossSite = discoverCrossSitePatterns(targetContext, researchData.openContext.contexts).slice(0, 5);
  const chronology = getChronologyPropagationModel(targetContext);
  const consistency = stratigraphicConsistencyScore(targetContext, reviewState, anomalyReview);
  const signature = compactSignature(targetContext);
  const topGap = gaps[0];
  const topLink = missingLinks[0];
  const topCross = crossSite[0];
  const anomalyInvestigation = buildAnomalyInvestigation(anomaly, working);
  const readableSite = targetContext.site || targetContext.project || 'this site';
  const mainMaterial = signature.materials[0] || signature.taxa[0] || 'a mixed evidence signature';
  const dateText = formatRange(targetContext.dateRange);

  const caseTemplates = [
    {
      id: `case-anomaly-${targetContext.id}-${seed}`,
      type: 'Anomaly Case',
      title: `The ${targetContext.site || 'Site'} Contradiction`,
      hook: `${anomaly?.record || targetContext.id} behaves like a break in the story: one clue is out of rhythm with the surrounding evidence.`,
      readingGuide: `Read this as a historical mystery. A context is a unit of excavation evidence, and this one contains a signal that does not fit neatly with the rest of the model. That mismatch may be caused by ancient behavior, later disturbance, or the way the material was recorded.`,
      generatedInterpretation: `Astraea is treating ${contextLabel(targetContext)} as a contested deposit rather than a settled fact. The context has ${number(targetContext.recordCount)} normalized records, a working date range of ${dateText}, and a current consistency score of ${consistency.score}%. The anomaly, "${anomaly?.evidence || 'unresolved evidence signal'}", matters because it changes the confidence of the entire interpretation: a small disturbance in one layer can make nearby dates, artifacts, and stratigraphic relationships harder to trust. The strongest reading is not that the record is wrong; it is that the deposit needs to be explained as a sequence of events rather than a single clean moment.`,
      outputs: {
        lab: `Laboratory reading: start by treating the anomaly as an evidence conflict. The material pattern, especially ${mainMaterial}, gives the context archaeological weight, but the unusual signal prevents an easy interpretation. Astraea would compare the affected record against neighboring contexts, look for repeated disturbance language, and check whether the same material class appears in layers above or below. If the signal appears only once, a recording issue becomes plausible. If it repeats across connected layers, the stronger interpretation is that the site formation process itself was complex.`,
        field: `Field mission: revisit the boundary of ${targetContext.id} as if the edge of the deposit is the main question. The practical task is to ask whether the excavated layer represents one event, several events compressed together, or a later intrusion into older material. Photograph or inspect section drawings if available, compare sediment descriptions, and look for evidence that the anomalous material entered the context after deposition. The goal is not to "solve" it immediately; the goal is to decide which explanation deserves confidence.`,
        seminar: `Seminar briefing: this case is useful because it demonstrates why archaeological interpretation is not just classification. A single context can hold thousands of records and still remain ambiguous. Here, Astraea identifies a tension between the dominant evidence signature and a smaller disruptive clue. That tension opens three defensible readings: real activity change, mixed deposition, or source-model mismatch. A good seminar discussion would ask which evidence would change our mind first.`,
        exhibit: `Public interpretation: this case shows how archaeologists turn fragments into history carefully. One unusual clue does not overturn an entire site story, but it asks for attention. Astraea highlights the clue, connects it to the layer where it was found, and shows why experts keep uncertainty visible instead of hiding it behind a polished conclusion.`,
      },
    },
    {
      id: `case-gap-${targetContext.id}-${seed}`,
      type: 'Research Gap',
      title: `${topGap?.title || 'Chronology'} As A Research Mission`,
      hook: topGap ? `${number(topGap.count)} records or contexts point to the same weak spot in the interpretation.` : 'Astraea found the part of the evidence model that most needs a researcher’s attention.',
      readingGuide: `Read this as the app asking, "What evidence would make the story stronger?" A research gap is not a failure. It is the most useful place to work next because filling it can tighten dates, clarify phases, or prevent an attractive but unsupported interpretation.`,
      generatedInterpretation: topGap ? `The main gap is ${topGap.title.toLowerCase()}. Astraea flags it because the current evidence can support a broad narrative, but not yet a precise one. ${topGap.action} In practical terms, this means the researcher should resist making a confident claim about sequence, abandonment, continuity, or change until this gap is narrowed. The gap is valuable because it gives the project a direction: not "review everything," but investigate the exact weakness that currently limits interpretation.` : `Astraea could not find one dominant gap, so it generated a broader mission: identify the evidence class most responsible for uncertainty. That usually means dates, source links, stratigraphic labels, or coordinates. The app is pushing the user toward a sharper research question instead of another passive overview.`,
      outputs: {
        lab: `Laboratory reading: this case turns absence into evidence. Missing dates, weak labels, or sparse source links do not simply reduce confidence; they shape what kinds of historical questions can be asked. If chronology is weak, the researcher can discuss association but not tempo. If stratigraphic labels are weak, the researcher can compare materials but should be cautious about sequence. Astraea ranks the gap so the user can choose work that will improve the model rather than just add more information.`,
        field: `Field mission: collect the missing constraint that would most reduce uncertainty. That may mean linking a context to an existing radiocarbon sample, checking whether a ceramic group provides a tighter date, verifying a trench coordinate, or separating a broad excavation label into cleaner units. The field-style action is focused: one missing evidence class, one interpretive payoff, one reason the work matters.`,
        seminar: `Seminar briefing: the strongest historical arguments often come from knowing what the data cannot yet say. This generated case explains the boundary of the interpretation. It asks students or researchers to distinguish between an interesting pattern and a defensible claim. The discussion should center on what evidence would move the argument from plausible to persuasive.`,
        exhibit: `Public interpretation: archaeology is careful because the past rarely arrives complete. This case shows visitors that an unknown is not an empty space; it is a research target. Astraea identifies what is missing and explains how filling that gap would make the story clearer.`,
      },
    },
    {
      id: `case-harris-${targetContext.id}-${seed}`,
      type: 'Harris Matrix Move',
      title: topLink ? `Test ${topLink.direction}` : 'Find The Missing Stratigraphic Link',
      hook: topLink ? `Astraea found a possible before-and-after relationship that could change the site sequence.` : 'The site story needs a stronger bridge between layers before the timeline can tighten.',
      readingGuide: `Read this as a proposed edit to the site's timeline. A Harris Matrix is a graph of archaeological order: what came before, what came after, what cuts into what, and what fills what. Astraea is not declaring the relationship true; it is giving the researcher a candidate move to test.`,
      generatedInterpretation: topLink ? `The proposed relationship is ${topLink.direction}. Astraea suggests it because ${topLink.rationale}. If accepted, this edge would make the chronology less vague by placing one context in relation to another. If rejected, that rejection is also meaningful: it tells the model that similarity in date, site, or label is not enough. The intellectual work is to decide whether the connection reflects a real depositional sequence or just a resemblance produced by messy excavation metadata.` : `No strong missing link appears under the current evidence view. That is a useful result, not a dead end. It means the selected context may be isolated, under-labelled, or connected through evidence that has not yet been normalized. The next move is to widen the context set, inspect source notes, or compare material signatures rather than forcing a graph edge that cannot be defended.`,
      outputs: {
        lab: `Laboratory reading: treat the edge as a hypothesis about time. A matrix link should survive multiple checks: labels, source notes, spatial proximity, date compatibility, and material continuity. If those checks agree, the model becomes sharper. If they disagree, the contradiction may reveal a reused deposit, a disturbed interface, or a recording convention that hides the original excavation logic.`,
        field: `Field mission: inspect the two contexts named in the candidate edge. Look for words like above, below, cut, fill, sealed, interface, floor, pit, or collapse in field records. If drawings or photographs exist, compare boundaries before relying on the generated relationship. The decision should be made from archaeological evidence, not from graph neatness.`,
        seminar: `Seminar briefing: this case is about how archaeologists turn spatial excavation into historical sequence. A Harris Matrix is powerful because it makes assumptions visible. Astraea's candidate edge lets the group debate whether a relationship is warranted, which evidence would support it, and what part of the site story changes if the edge is accepted.`,
        exhibit: `Public interpretation: layers are not just stacked dirt. They are traces of actions happening before and after one another. This generated case shows how a single relationship between two layers can change the order of a site's story.`,
      },
    },
    {
      id: `case-regional-${targetContext.id}-${seed}`,
      type: 'Cross-Site Pattern',
      title: topCross ? `${contextLabel(targetContext)} Echoes ${distinctContextLabel(targetContext, topCross.context)}` : 'Search For A Regional Echo',
      hook: topCross ? `Astraea found another context with a similar evidence signature, inviting comparison beyond one trench or site.` : 'The selected context may be distinctive, or the dataset may not yet describe its best comparison.',
      readingGuide: `Read this as pattern discovery rather than proof. Similar artifacts, materials, dates, or source signatures can suggest shared practices, regional habits, exchange, or simply comparable site formation. The value is the trail it opens, not a finished conclusion.`,
      generatedInterpretation: topCross ? `The closest generated comparison is ${distinctContextLabel(targetContext, topCross.context)} with a ${topCross.score}% similarity score. The match is driven by ${topCross.reasons.join(', ')}. This does not prove trade, migration, contact, or cultural sameness. It does something more useful for research: it names a second place where the same kind of evidence deserves attention. The comparison can reveal whether the selected context is ordinary, exceptional, or part of a wider regional rhythm.` : `Astraea did not find a confident analogue at the current threshold. That absence can mean several things: the selected context may be genuinely unusual, the relevant variables may be missing, or the comparison set may be too narrow. The best next step is not to invent a connection, but to decide which additional evidence would make regional comparison possible.`,
      outputs: {
        lab: `Laboratory reading: compare the two contexts variable by variable. Which similarity is strongest: material, taxa, chronology, source dataset, or density? A useful regional comparison should not depend on one superficial overlap. It should hold across several evidence classes or clearly explain why one variable matters more than the others.`,
        field: `Field mission: treat the comparison as a request for targeted checking. If the match is driven by material evidence, inspect artifact classification. If it is driven by chronology, check dating quality. If it is driven by source dataset, watch for shared recording conventions that may create artificial similarity.`,
        seminar: `Seminar briefing: this case helps explain the difference between resemblance and interpretation. Students can ask whether similarity reflects shared behavior, similar environments, comparable excavation methods, or the limits of the data model. The point is not to jump to a dramatic connection; it is to practice disciplined comparison.`,
        exhibit: `Public interpretation: one find becomes more meaningful when it can be compared with another. Astraea shows how a single excavated context can be placed beside a wider pattern, while keeping the uncertainty visible.`,
      },
    },
  ];

  return caseTemplates.map((template, index) => {
    const caseContext = index === 0 ? anomalyInvestigation.context : targetContext;
    const caseSignature = compactSignature(caseContext);
    const rivalInterpretations = buildRivalInterpretations({
      type: template.type,
      caseContext,
      anomaly,
      topGap,
      topLink,
      topCross,
      chronology,
      consistency,
      signature: caseSignature,
      weakContext: weak.includes(caseContext),
    });

    return {
      ...template,
      id: `${template.id}-${index}`,
      context: caseContext,
      confidence: Math.max(34, Math.min(96, Math.round((consistency.score + (anomaly?.severity || 45) + (topLink?.score || 35)) / 3))),
      readingGuide: template.readingGuide,
      evidenceChain: [
        `${caseContext.id}: ${contextLabel(caseContext)}`,
        `${number(caseContext.recordCount)} normalized evidence records`,
        `Date signal: ${formatRange(caseContext.dateRange)}`,
        caseSignature.materials.length ? `Material signature: ${caseSignature.materials.join(', ')}` : 'Material signature needs classification review',
        caseSignature.taxa.length ? `Taxa / category signal: ${caseSignature.taxa.join(', ')}` : 'Taxa/category evidence is sparse',
        anomaly ? `Anomaly clue: ${anomaly.type} — ${anomaly.evidence}` : 'No anomaly clue selected',
      ],
      rivalInterpretations,
      generatedOutputs: {
        lab: template.outputs.lab,
        field: template.outputs.field,
        seminar: template.outputs.seminar,
        exhibit: template.outputs.exhibit,
      },
      autoBriefing: [
        `Question: What does ${caseContext.id} actually represent?`,
        `Best current lead: ${rivalInterpretations[0].title}.`,
        `Main uncertainty: ${topGap?.title || 'whether the context has enough chronological and stratigraphic resolution'}.`,
        `Next test: ${topLink ? `verify ${topLink.direction}` : 'compare neighboring contexts and inspect source notes for missing relationship language'}.`,
      ],
      missionSteps: [
        `Open ${caseContext.id} and compare source labels against the generated interpretation.`,
        topLink ? `Test the candidate edge ${topLink.direction} in the Harris Matrix.` : 'Generate a wider missing-link search by loosening filters.',
        topCross ? `Compare against ${topCross.context.id} because ${topCross.reasons.join(', ')}.` : 'Search for a stronger cross-site analogue after adding more material labels.',
        `Use the chronology band ${formatYear(chronology.posterior.low68)} to ${formatYear(chronology.posterior.high68)} as a working uncertainty envelope.`,
      ],
      visualBeats: [
        { label: 'Evidence appears', detail: `${number(caseContext.recordCount)} records enter the model.` },
        { label: 'Pattern forms', detail: (caseSignature.materials[0] || caseSignature.taxa[0] || 'The source signature') + ' becomes the dominant clue.' },
        { label: 'Conflict interrupts', detail: anomaly?.evidence || 'A weak label or date gap prevents a simple story.' },
        { label: 'Research move', detail: topLink ? `Test ${topLink.direction}.` : `Resolve ${topGap?.title || 'the weakest evidence gap'}.` },
      ],
    };
  });
}

export function buildMarkdownReport({ selectedContext, reviewState }) {
  const overview = researchData.reports.overview;
  const pending = Object.values(reviewState).filter(value => value === 'pending').length;
  const accepted = Object.values(reviewState).filter(value => value === 'accepted').length;
  const rejected = Object.values(reviewState).filter(value => value === 'rejected').length;
  const context = selectedContext || researchData.openContext.contexts[0];

  return [
    '# Astraea Evidence Report',
    '',
    `Generated from Astraea's normalized archaeological evidence model.`,
    '',
    '## Dataset Scale',
    `- Open Context rows normalized: ${number(overview.totalOpenContextRows)}`,
    `- Canonical contexts identified: ${number(overview.totalCanonicalContexts)}`,
    `- Radiocarbon samples integrated: ${number(overview.radiocarbonSamples)}`,
    `- Mapped records integrated: ${number(overview.geoRecords)}`,
    '',
    '## Selected Context',
    `- Context: ${context.id}`,
    `- Label: ${contextLabel(context)}`,
    `- Project: ${context.project}`,
    `- Source dataset: ${context.sourceDataset}`,
    `- Evidence rows: ${number(context.recordCount)}`,
    `- Date range: ${formatRange(context.dateRange)}`,
    `- Confidence: ${Math.round(context.confidence)}%`,
    '',
    '## Harris Matrix Review State',
    `- Accepted provisional edges: ${accepted}`,
    `- Rejected provisional edges: ${rejected}`,
    `- Pending provisional edges: ${pending}`,
    '',
    '## Methodological Caution',
    'Astraea distinguishes source records from machine-assisted interpretations. Provisional stratigraphic relationships are candidates for review, not asserted archaeological facts.',
    '',
    '## Source and Citation Notes',
    ...citationRecords.map(item => `- ${item.label}: ${item.citation}`),
    '',
    '## Dataset-Derived Citations',
    ...actualCitationRecords.slice(0, 18).map(item => `- ${item.citation}`),
  ].join('\n');
}

export function downloadText(filename, text, type = 'text/markdown') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const siteOptions = researchData.openContext.siteCounts.map(([site]) => site).filter(Boolean).slice(0, 24);
export const projectOptions = researchData.openContext.projectCounts.map(([project]) => project).filter(Boolean).slice(0, 18);
export const sourceOptions = [...new Set(researchData.openContext.sourceSummaries.map(source => source.sourceName))];

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const openContextCitations = uniqueBy(
  researchData.geoRecords.records
    .filter(record => record.citationUri || record.uri)
    .map(record => ({
      type: 'Open Context record',
      label: record.label,
      source: record.project,
      citation: `${record.creator ? `${record.creator.replace(/\|/g, ', ')}. ` : ''}${record.label}. ${record.project}. Open Context record: ${record.uri}. Persistent citation URI: ${record.citationUri || record.uri}.`,
      uri: record.uri,
      citationUri: record.citationUri,
      use: 'Record-level citation for mapped field journals, documents, contexts, and spatial evidence.',
    })),
  item => item.citationUri || item.uri,
).slice(0, 16);

const radiocarbonCitations = uniqueBy(
  researchData.radiocarbon.records
    .filter(record => record.citation)
    .map(record => ({
      type: 'Radiocarbon bibliography',
      label: `${record.references || record.labNumber} · ${record.siteName}`,
      source: 'Oaxaca radiocarbon workbook',
      citation: record.citation,
      uri: '',
      citationUri: '',
      use: `Supports radiocarbon sample ${record.labNumber || 'unknown lab number'} from ${record.siteName || 'unknown site'}.`,
    })),
  item => item.citation,
).slice(0, 18);

export const actualCitationRecords = [
  ...openContextCitations,
  ...radiocarbonCitations,
  {
    type: 'Harris Matrix methodology',
    label: 'Dynamic 3D Visualisation of Harris Matrix Data',
    source: 'Conference paper',
    citation: 'Stawniak, Miroslaw, Krzysztof Walczak, and Bogdan Bobowski. “Dynamic 3D Visualisation of Harris Matrix Data.” Virtual Retrospect 2005, Biarritz, France, pp. 67–72. HAL: hal-01759198.',
    uri: '',
    citationUri: 'https://hal.science/hal-01759198',
    use: 'Methodological citation for Harris Matrix and spatial visualization concepts.',
  },
];

export const citationRecords = [
  {
    label: 'Open Context records',
    citation:
      'Open Context archaeological data records, accessed through local CSV and GeoJSON-style exports. Item URIs, citation URIs, project labels, and context URIs are retained in Astraea evidence records.',
    use:
      'Use record-level Open Context URIs/ARKs when citing individual artifacts, documents, contexts, or mapped records.',
  },
  {
    label: 'Čḯxwicən Bird Bone Project',
    citation:
      'The Čḯxwicən Bird Bone Project, Open Context data publication. Astraea preserves project label, source URIs, WGS84 coordinates, unit, strat, feature, and faunal identification fields.',
    use:
      'Used for unit/strat/feature-rich context modelling and taphonomic/anatomical evidence review.',
  },
  {
    label: 'Çatalhöyük Zooarchaeology',
    citation:
      'Çatalhöyük Zooarchaeology and related Anatolian zooarchaeological Open Context exports. Astraea preserves project labels, source files, context hierarchy, dates, coordinates, taxa, and anatomical fields.',
    use:
      'Used for large-scale context aggregation, faunal signatures, spatial clusters, and provisional graph review.',
  },
  {
    label: 'Oaxaca radiocarbon samples',
    citation:
      'Oaxaca radiocarbon date workbook. Astraea preserves lab number, material, method, normalized age, sigma, UTM coordinates, site, excavation unit, stratigraphic unit, references, and embedded American Antiquity-style citations where supplied.',
    use:
      'Use row-level References and Full Am Antiq Citation fields for individual radiocarbon samples.',
  },
  {
    label: 'Harris Matrix visualization methodology',
    citation:
      'Stawniak, Miroslaw, Krzysztof Walczak, and Bogdan Bobowski. “Dynamic 3D Visualisation of Harris Matrix Data.” Virtual Retrospect 2005, Biarritz, France, pp. 67–72. HAL: hal-01759198.',
    use:
      'Used as methodology support for combining spatial unit visualization with symbolic Harris Matrix relationships.',
  },
  {
    label: 'Upland shell and groundstone tables',
    citation:
      'Upland artifact count workbooks supplied as local research datasets. These files do not embed full publication metadata in the workbook sheets; Astraea labels them as source tables and keeps filenames visible until repository-level citation details are added.',
    use:
      'Used for stratum-level artifact distribution and comparison workflow demonstration.',
  },
];
