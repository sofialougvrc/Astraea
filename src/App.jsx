import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  actualCitationRecords,
  buildMarkdownReport,
  chronologyForSite,
  citationRecords,
  compareSites,
  contextLabel,
  downloadText,
  filterContexts,
  formatRange,
  formatYear,
  buildEvidenceObject,
  buildPastReconstruction,
  buildAnomalyInvestigation,
  defaultHypotheses,
  discoverCrossSitePatterns,
  discoverResearchGaps,
  generateAstraeaCaseFiles,
  getEvidenceLayerObjectives,
  getChronologyPropagationModel,
  getGraphModel,
  getMultiContextChronologyModel,
  getMissingLinkCandidates,
  getReconciliationQueues,
  inferPhaseModel,
  number,
  pct,
  projectOptions,
  researchData,
  siteOptions,
  stratigraphicConsistencyScore,
  scoreHypotheses,
  sourceShortName,
  sourceOptions,
} from './lib/research.js';
import { getApiHealth } from './lib/api.js';
import { calibrationCurveSummaries } from './lib/calibration.js';

const local = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function AstraeaOrientation() {
  return (
    <section className="panel orientation-panel" id="guide">
      <div className="section-heading">
        <span>How To Read Astraea</span>
        <h2>A Research Instrument, Not A Database</h2>
        <p>Astraea starts with archaeological records and turns them into questions. It helps the user see where evidence is strong, where the story is uncertain, and which interpretation deserves to be tested next.</p>
      </div>
      <div className="orientation-grid">
        <article>
          <strong>1</strong>
          <h3>Generate a case</h3>
          <p>The app creates a focused archaeological problem from the dataset: an anomaly, a missing link, a weak chronology, or a regional comparison.</p>
        </article>
        <article>
          <strong>2</strong>
          <h3>Read the evidence</h3>
          <p>Each case explains what the record means, why it matters, and which clues support or weaken the interpretation.</p>
        </article>
        <article>
          <strong>3</strong>
          <h3>Test the sequence</h3>
          <p>The Harris Matrix is where interpretation becomes structure: the user can accept, reject, or create relationships between contexts.</p>
        </article>
        <article>
          <strong>4</strong>
          <h3>Keep the reasoning</h3>
          <p>Important cases and observations can be pinned into the notebook, preserving the research trail instead of burying it in exports.</p>
        </article>
      </div>
    </section>
  );
}

function CommandCenter({ contexts, selectedContext, editorState, edgeReview, anomalyReview }) {
  const reviewedContexts = Object.values(editorState).filter(item => item?.status && item.status !== 'unreviewed').length;
  const acceptedEdges = Object.values(edgeReview).filter(status => status === 'accepted').length;
  const openAnomalies = researchData.reports.anomalies.filter((item, index) => anomalyReview[`${item.record}-${index}`] !== 'dismissed').length;
  const score = stratigraphicConsistencyScore(selectedContext || contexts[0], edgeReview, anomalyReview);
  const queues = getReconciliationQueues(contexts, editorState);
  const completion = Math.min(100, Math.round(((reviewedContexts * 1.4) + (acceptedEdges * 2.2)) / Math.max(1, contexts.length) * 100));

  return (
    <section className="panel gold-frame" id="command">
      <div className="section-heading">
        <span>Research Command Center</span>
        <h2>What Needs Archaeological Attention?</h2>
        <p>Astraea now starts from work queues: contexts to reconcile, edges to review, chronology risks to inspect, and evidence packets to prepare.</p>
      </div>
      <div className="command-grid">
        <MetricCard label="Visible Review Progress" value={`${completion}%`} detail={`${number(reviewedContexts)} reviewed context states · ${number(acceptedEdges)} accepted provisional edges`} />
        <MetricCard label="Open Review Signals" value={number(openAnomalies)} detail="Taphonomic, recording, chronology, and graph signals still available for triage." />
        <MetricCard label="Selected Consistency" value={`${score.score}%`} detail={`${score.level}: ${selectedContext?.id || contexts[0]?.id || 'no context selected'}`} />
      </div>
      <div className="consistency-strip">
        <i style={{ width: `${score.score}%` }} />
      </div>
      <div className="queue-overview">
        {queues.map(queue => (
          <article key={queue.id}>
            <strong>{queue.count}</strong>
            <span>{queue.label}</span>
            <p>{queue.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GenerativeDiscoveryEngine({ contexts, selectedContext, edgeReview, anomalyReview, manualRelationships, editorState, onSelect, onPin }) {
  const [seed, setSeed] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState('lab');
  const [archive, setArchive] = useState(() => local.get('astraea-generated-case-archive', []));
  const cases = useMemo(() => generateAstraeaCaseFiles({
    contexts,
    selectedContext,
    reviewState: edgeReview,
    anomalyReview,
    manualRelationships,
    editorState,
    seed,
  }), [contexts, selectedContext, edgeReview, anomalyReview, manualRelationships, editorState, seed]);
  const activeCase = cases[activeIndex] || cases[0];

  function generateNext() {
    setSeed(value => value + 1);
    setActiveIndex(index => (index + 1) % Math.max(1, cases.length));
  }

  function saveGeneratedCase() {
    if (!activeCase) return;
    const entry = {
      id: `${activeCase.id}-${Date.now()}`,
      title: activeCase.title,
      type: activeCase.type,
      context: activeCase.context.id,
      briefing: activeCase.autoBriefing,
      at: new Date().toLocaleString(),
    };
    const next = [entry, ...archive].slice(0, 8);
    setArchive(next);
    local.set('astraea-generated-case-archive', next);
  }

  if (!activeCase) return null;

  return (
    <section className="panel gold-frame generator-console" id="generator">
      <div className="section-heading">
        <span>Astraea Generates</span>
        <h2>Archaeological Case File Generator</h2>
        <p>Press one button and Astraea turns the loaded evidence into a research mystery: interpretation, rival theories, evidence chain, and next moves.</p>
      </div>
      <div className="generator-layout">
        <aside className="case-switcher">
          <button type="button" className="generate-button" onClick={generateNext}>Generate new case file</button>
          {cases.map((item, index) => (
            <button className={activeIndex === index ? 'active' : ''} type="button" key={item.id} onClick={() => setActiveIndex(index)}>
              <strong>{item.type}</strong>
              <span>{item.title}</span>
            </button>
          ))}
          <div className="mode-tabs">
            {[
              ['lab', 'Lab read'],
              ['field', 'Field mission'],
              ['seminar', 'Seminar script'],
              ['exhibit', 'Exhibit label'],
            ].map(([id, label]) => (
              <button className={mode === id ? 'active' : ''} type="button" key={id} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>
        </aside>

        <article className="generated-case">
          <div className="generated-case-head">
            <span>{activeCase.type} · {activeCase.confidence}% generated confidence</span>
            <h3>{activeCase.title}</h3>
            <p>{activeCase.hook}</p>
          </div>
          <div className="generated-output">
            <strong>Reading guide</strong>
            <p>{activeCase.readingGuide}</p>
            <strong>Generated interpretation</strong>
            <p>{activeCase.generatedInterpretation}</p>
            <strong>{mode === 'lab' ? 'Astraea lab read' : mode === 'field' ? 'Field mission' : mode === 'seminar' ? 'Seminar briefing' : 'Public-facing interpretation'}</strong>
            <p>{activeCase.generatedOutputs[mode]}</p>
          </div>
          <div className="evidence-chain">
            {activeCase.evidenceChain.map((item, index) => (
              <div key={`${item}-${index}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="generated-actions">
            <button type="button" onClick={() => onSelect(activeCase.context)}>Open generated context</button>
            <button type="button" onClick={saveGeneratedCase}>Save generated case</button>
            <button type="button" onClick={() => onPin({ type: 'generated-case', id: activeCase.id, label: activeCase.title, note: activeCase.generatedInterpretation })}>Pin generated case</button>
          </div>
        </article>

        <aside className="mission-board">
          <div>
            <span>Rival theories</span>
            {activeCase.rivalInterpretations.map(theory => (
              <article key={theory.title}>
                <strong>{theory.score}%</strong>
                <h4>{theory.title}</h4>
                <p>{theory.claim}</p>
                {theory.evidence?.length ? (
                  <ul>
                    {theory.evidence.map(item => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
                {theory.nextTest ? <em>Next test: {theory.nextTest}</em> : null}
              </article>
            ))}
          </div>
          <div>
            <span>Generated mission plan</span>
            {activeCase.missionSteps.map(step => <p key={step}>{step}</p>)}
          </div>
        </aside>
      </div>
      <div className="story-beats">
        {activeCase.visualBeats.map(beat => (
          <article key={beat.label}>
            <span>{beat.label}</span>
            <p>{beat.detail}</p>
          </article>
        ))}
      </div>
      <div className="case-archive">
        <span>Generated case archive</span>
        {archive.length ? archive.map(item => (
          <article key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.type} · {item.context} · {item.at}</p>
          </article>
        )) : <p>No generated cases saved yet. Generate one that feels worth investigating.</p>}
      </div>
    </section>
  );
}

function ReconciliationStudio({ contexts, editorState, onEditorChange, onSelect }) {
  const [activeQueue, setActiveQueue] = useState('high-value');
  const queues = getReconciliationQueues(contexts, editorState);
  const queue = queues.find(item => item.id === activeQueue) || queues[0];

  function markContext(context, status) {
    const current = editorState[context.id] || { note: '' };
    onEditorChange(context.id, {
      ...current,
      status,
      note: current.note || `Queued through ${queue.label}.`,
    });
  }

  return (
    <section className="panel" id="reconcile">
      <div className="section-heading">
        <span>Stratigraphic Reconciliation Studio</span>
        <h2>Turn Messy Records Into Reviewed Contexts</h2>
        <p>Choose a queue, inspect the riskiest contexts, assign local review states, and move evidence toward a defensible depositional model.</p>
      </div>
      <div className="map-controls">
        {queues.map(item => (
          <button className={activeQueue === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setActiveQueue(item.id)}>
            {item.label} · {item.count}
          </button>
        ))}
      </div>
      <div className="reconcile-layout">
        <article className="queue-brief">
          <span>{queue.label}</span>
          <h3>{queue.count} contexts</h3>
          <p>{queue.description}</p>
          <small>Recommended action: mark as {queue.recommendedStatus.replaceAll('-', ' ')} after source inspection.</small>
        </article>
        <div className="reconcile-list">
          {queue.contexts.length ? queue.contexts.map(context => {
            const score = stratigraphicConsistencyScore(context);
            return (
              <article key={context.id}>
                <div>
                  <span>{context.id} · {score.level}</span>
                  <h3>{contextLabel(context)}</h3>
                  <p>{number(context.recordCount)} records · {formatRange(context.dateRange)} · {context.sourceDataset}</p>
                </div>
                <div className="review-buttons">
                  <button type="button" onClick={() => onSelect(context)}>Open</button>
                  <button type="button" onClick={() => markContext(context, queue.recommendedStatus)}>Mark</button>
                </div>
              </article>
            );
          }) : <p>This queue is clear under the current filters.</p>}
        </div>
      </div>
    </section>
  );
}

function PastReconstructionConsole({ contexts, selectedContext, edgeReview, anomalyReview, manualRelationships, editorState }) {
  const [modelType, setModelType] = useState('reconciled');
  const [lens, setLens] = useState('stratigraphy');
  const [questionId, setQuestionId] = useState('what-happened');
  const [decisionLog, setDecisionLog] = useState(() => local.get('astraea-reconstruction-decisions', []));
  const reconstruction = buildPastReconstruction({
    contexts,
    selectedContext,
    modelType,
    lens,
    reviewState: edgeReview,
    anomalyReview,
    manualRelationships,
    editorState,
  });
  const activeQuestion = reconstruction.questions.find(question => question.id === questionId) || reconstruction.questions[0];

  function recordDecision(card, verdict) {
    const entry = {
      at: new Date().toLocaleString(),
      model: reconstruction.modelTitle,
      card: card.title,
      verdict,
      confidence: card.confidence,
    };
    const next = [entry, ...decisionLog].slice(0, 12);
    setDecisionLog(next);
    local.set('astraea-reconstruction-decisions', next);
  }

  function exportReconstruction() {
    const dossier = {
      title: reconstruction.modelTitle,
      anchorContext: reconstruction.anchor.id,
      confidence: reconstruction.confidence,
      lens,
      narrative: reconstruction.lensNarrative,
      contradictions: reconstruction.contradictions,
      cards: reconstruction.cards,
      stats: reconstruction.stats,
      decisions: decisionLog,
    };
    downloadText('astraea-past-reconstruction-dossier.json', JSON.stringify(dossier, null, 2), 'application/json');
  }

  return (
    <section className="panel gold-frame reconstruction-console" id="reconstruct">
      <div className="section-heading">
        <span>Past Reconstruction Console</span>
        <h2>Reconstruct The Past, Then Challenge It</h2>
        <p>Astraea generates a defensible interpretation from contexts, dates, anomalies, citations, and graph relationships. Your job is to interrogate the model until only the strongest reconstruction remains.</p>
      </div>
      <div className="reconstruction-hero">
        <article>
          <span>{reconstruction.anchor.id} · {contextLabel(reconstruction.anchor)}</span>
          <h3>{reconstruction.modelTitle}</h3>
          <p>{reconstruction.lensNarrative}</p>
          <div className="reconstruction-score">
            <strong>{reconstruction.confidence}%</strong>
            <div className="consistency-strip"><i style={{ width: `${reconstruction.confidence}%` }} /></div>
          </div>
        </article>
        <aside>
          <label>
            Reconstruction model
            <select value={modelType} onChange={event => setModelType(event.target.value)}>
              <option value="conservative">Conservative Past</option>
              <option value="reconciled">Reconciled Past</option>
              <option value="disturbance">Disturbance-Aware Past</option>
            </select>
          </label>
          <label>
            Evidence lens
            <select value={lens} onChange={event => setLens(event.target.value)}>
              <option value="stratigraphy">Stratigraphy</option>
              <option value="chronology">Chronology</option>
              <option value="materials">Materials</option>
              <option value="anomaly">Anomaly</option>
              <option value="citation">Citation</option>
            </select>
          </label>
          <button type="button" onClick={exportReconstruction}>Export reconstruction dossier</button>
        </aside>
      </div>
      <div className="reconstruction-stats">
        <MetricCard label="Contexts In Model" value={number(reconstruction.stats.contextCount)} detail="Visible contexts used to build the reconstruction." />
        <MetricCard label="Graph Edges" value={number(reconstruction.graph.relationships.length)} detail={`${number(reconstruction.stats.acceptedEdges)} accepted · ${number(reconstruction.stats.rejectedEdges)} rejected`} />
        <MetricCard label="Anomaly Burden" value={`${Math.round(reconstruction.stats.anomalyBurden * 100)}%`} detail={`${number(reconstruction.anomalySet.length)} anomaly signal(s) in scope.`} />
        <MetricCard label="Date Coverage" value={`${Math.round(reconstruction.stats.dateCoverage * 100)}%`} detail="Contexts with usable date ranges." />
      </div>
      <div className="ask-past">
        <div>
          <span>Ask The Past</span>
          <h3>{activeQuestion.label}</h3>
          <p>{activeQuestion.answer}</p>
        </div>
        <div className="question-list">
          {reconstruction.questions.map(question => (
            <button className={question.id === questionId ? 'active' : ''} type="button" key={question.id} onClick={() => setQuestionId(question.id)}>{question.label}</button>
          ))}
        </div>
      </div>
      <div className="interpretation-grid">
        {reconstruction.cards.map(card => (
          <article key={card.id}>
            <span>{card.confidence}% confidence</span>
            <h3>{card.title}</h3>
            <p>{card.claim}</p>
            <div className="evidence-columns">
              <div>
                <strong>Evidence for</strong>
                {card.evidenceFor.length ? card.evidenceFor.map(item => <small key={item}>{item}</small>) : <small>No supporting evidence listed.</small>}
              </div>
              <div>
                <strong>Evidence against</strong>
                {card.evidenceAgainst.length ? card.evidenceAgainst.map(item => <small key={item}>{item}</small>) : <small>No immediate contradiction.</small>}
              </div>
            </div>
            <p><strong>Next action:</strong> {card.action}</p>
            <div className="review-buttons">
              {['accept', 'challenge', 'uncertain'].map(verdict => (
                <button type="button" key={verdict} onClick={() => recordDecision(card, verdict)}>{verdict}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="contradiction-board">
        <div className="section-heading">
          <span>Contradiction Hunter</span>
          <h2>What Could Break This Reconstruction?</h2>
          <p>These are not decorations. These are the claims that need to be resolved before the past-state model becomes defensible.</p>
        </div>
        <div className="contradiction-list">
          {reconstruction.contradictions.length ? reconstruction.contradictions.map(item => (
            <article key={`${item.type}-${item.text}`}>
              <strong>{item.severity}</strong>
              <span>{item.type}</span>
              <p>{item.text}</p>
            </article>
          )) : <p>No major contradictions are visible under this lens and model. Continue checking edge evidence and citations.</p>}
        </div>
      </div>
      <div className="decision-log">
        <span>Human Decision Trail</span>
        {decisionLog.length ? decisionLog.map(item => (
          <article key={`${item.at}-${item.card}-${item.verdict}`}>
            <strong>{item.verdict}</strong>
            <p>{item.card} · {item.model} · {item.confidence}% · {item.at}</p>
          </article>
        )) : <p>No reconstruction decisions yet. Accept, challenge, or mark interpretation cards as uncertain.</p>}
      </div>
    </section>
  );
}

function HypothesisTestingWorkspace({ contexts, anomalyReview, notebookPins, onPin }) {
  const [hypotheses, setHypotheses] = useState(() => local.get('astraea-hypotheses', defaultHypotheses));
  const [draft, setDraft] = useState({ title: '', claim: '', expectedSignals: '' });
  const [challenged, setChallenged] = useState(() => local.get('astraea-hypothesis-challenges', {}));
  const scored = scoreHypotheses(hypotheses, contexts, anomalyReview, notebookPins);

  function addHypothesis() {
    if (!draft.title.trim() || !draft.claim.trim()) return;
    const next = [{
      id: `hyp-${Date.now()}`,
      title: draft.title,
      claim: draft.claim,
      expectedSignals: draft.expectedSignals.split(',').map(item => item.trim()).filter(Boolean),
      weakSignals: ['no supporting context', 'contradictory chronology', 'weak source evidence'],
    }, ...hypotheses];
    setHypotheses(next);
    local.set('astraea-hypotheses', next);
    setDraft({ title: '', claim: '', expectedSignals: '' });
  }

  function challenge(id, note) {
    const next = { ...challenged, [id]: note };
    setChallenged(next);
    local.set('astraea-hypothesis-challenges', next);
  }

  return (
    <section className="panel gold-frame" id="hypotheses">
      <div className="section-heading">
        <span>Historical Hypothesis Testing</span>
        <h2>Competing Explanations Lab</h2>
        <p>Create rival explanations and let Astraea compare them against anomaly text, context labels, materials, dates, and pinned evidence.</p>
      </div>
      <div className="hypothesis-lab">
        <aside className="hypothesis-builder">
          <h3>Create hypothesis</h3>
          <input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Hypothesis title" />
          <textarea value={draft.claim} onChange={event => setDraft({ ...draft, claim: event.target.value })} placeholder="Claim this hypothesis makes..." />
          <input value={draft.expectedSignals} onChange={event => setDraft({ ...draft, expectedSignals: event.target.value })} placeholder="Expected signals, comma separated" />
          <button type="button" onClick={addHypothesis}>Add hypothesis</button>
        </aside>
        <div className="hypothesis-grid">
          {scored.map(item => (
            <article key={item.id}>
              <span>{item.score}% support</span>
              <h3>{item.title}</h3>
              <p>{item.claim}</p>
              <div className="consistency-strip compact"><i style={{ width: `${item.score}%` }} /></div>
              <div className="evidence-columns">
                <div>
                  <strong>Supports</strong>
                  {item.support.length ? item.support.slice(0, 3).map(hit => <small key={`${hit.signal}-${hit.text}`}>{hit.signal}: {hit.text}</small>) : <small>No strong support found yet.</small>}
                </div>
                <div>
                  <strong>Contradicts</strong>
                  {item.contradictions.length ? item.contradictions.slice(0, 3).map(hit => <small key={`${hit.signal}-${hit.text}`}>{hit.signal}: {hit.text}</small>) : <small>No explicit contradiction found.</small>}
                </div>
              </div>
              <p><strong>Next test:</strong> {item.nextTest}</p>
              <textarea value={challenged[item.id] || ''} onChange={event => challenge(item.id, event.target.value)} placeholder="Challenge this assumption..." />
              <button type="button" onClick={() => onPin({ type: 'hypothesis', id: item.id, label: item.title, note: item.claim })}>Pin hypothesis</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResearchGapDiscovery({ contexts, editorState, edgeReview, onSelect, onPin }) {
  const [focus, setFocus] = useState('all');
  const gaps = discoverResearchGaps(contexts, editorState, edgeReview);
  const visible = focus === 'all' ? gaps : gaps.filter(gap => gap.title === focus);

  return (
    <section className="panel" id="gaps">
      <div className="section-heading">
        <span>Research Gap Discovery Engine</span>
        <h2>What Should Be Investigated Next?</h2>
        <p>Astraea ranks missing dates, weak labels, source gaps, spatial uncertainty, and graph contradiction debt so the user always has a next research move.</p>
      </div>
      <div className="map-controls">
        <button className={focus === 'all' ? 'active' : ''} type="button" onClick={() => setFocus('all')}>All gaps</button>
        {gaps.map(gap => <button className={focus === gap.title ? 'active' : ''} key={gap.title} type="button" onClick={() => setFocus(gap.title)}>{gap.title}</button>)}
      </div>
      <div className="gap-grid">
        {visible.map(gap => (
          <article key={gap.title}>
            <span>priority {gap.severity}</span>
            <h3>{gap.title}</h3>
            <p>{gap.action}</p>
            <strong>{number(gap.count)} affected item(s)</strong>
            <div className="consistency-strip compact"><i style={{ width: `${gap.severity}%` }} /></div>
            <div className="phase-context-list">
              {gap.contexts.slice(0, 5).map(context => <button type="button" key={context.id} onClick={() => onSelect(context)}>{context.id} · {contextLabel(context)}</button>)}
            </div>
            <button type="button" onClick={() => onPin({ type: 'research-gap', id: gap.title, label: gap.title, note: gap.action })}>Pin research gap</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceInvestigationMode({ contexts, onReview, onSelect, onPin }) {
  const anomalies = researchData.reports.anomalies.slice(0, 120);
  const [activeIndex, setActiveIndex] = useState(0);
  const investigation = buildAnomalyInvestigation(anomalies[activeIndex], contexts);

  return (
    <section className="panel gold-frame" id="investigate">
      <div className="section-heading">
        <span>Evidence Investigation Mode</span>
        <h2>Solve The Anomaly</h2>
        <p>Click an anomaly and Astraea opens a research case: affected context, possible explanations, chronology, graph links, and review actions.</p>
      </div>
      <div className="investigation-layout">
        <div className="case-list">
          {anomalies.map((item, index) => (
            <button className={index === activeIndex ? 'active' : ''} type="button" key={`${item.record}-${index}`} onClick={() => setActiveIndex(index)}>
              <strong>{item.record || item.context}</strong>
              <span>{item.type}</span>
              <small>{item.site} · severity {item.severity}</small>
            </button>
          ))}
        </div>
        <article className="case-board">
          <span>{investigation.context.id}</span>
          <h3>{investigation.researchQuestion}</h3>
          <p>{investigation.anomaly?.evidence}</p>
          <div className="detail-grid">
            <span><strong>Context</strong>{contextLabel(investigation.context)}</span>
            <span><strong>Chronology</strong>{formatRange(investigation.context.dateRange)}</span>
            <span><strong>Edges</strong>{investigation.edges.length}</span>
            <span><strong>Related signals</strong>{investigation.related.length}</span>
          </div>
          <div className="hypothesis-grid compact">
            {investigation.explanations.map(explanation => (
              <article key={explanation.title}>
                <span>{explanation.likelihood}% likelihood</span>
                <h3>{explanation.title}</h3>
                <p>{explanation.test}</p>
              </article>
            ))}
          </div>
          <div className="review-buttons">
            <button type="button" onClick={() => onSelect(investigation.context)}>Open context</button>
            <button type="button" onClick={() => onReview(`${investigation.anomaly.record}-${activeIndex}`, 'accepted')}>Accept anomaly</button>
            <button type="button" onClick={() => onReview(`${investigation.anomaly.record}-${activeIndex}`, 'dismissed')}>Dismiss anomaly</button>
            <button type="button" onClick={() => onPin({ type: 'anomaly-case', id: investigation.anomaly.record, label: investigation.researchQuestion, note: investigation.anomaly.evidence })}>Pin case</button>
          </div>
        </article>
      </div>
    </section>
  );
}

function CrossSiteDiscovery({ selectedContext, onSelect, onPin }) {
  const [threshold, setThreshold] = useState(45);
  const matches = discoverCrossSitePatterns(selectedContext, researchData.openContext.contexts).filter(item => item.score >= threshold);

  return (
    <section className="panel" id="cross-site">
      <div className="section-heading">
        <span>Cross-Site Discovery Engine</span>
        <h2>Find Similar Contexts Across The Dataset</h2>
        <p>Explore contexts with overlapping materials, taxa, chronology, and source signatures. This turns isolated sites into a regional pattern search.</p>
      </div>
      <label>
        Similarity threshold: {threshold}
        <input type="range" min="20" max="90" value={threshold} onChange={event => setThreshold(Number(event.target.value))} />
      </label>
      <div className="cross-site-grid">
        {matches.map(match => (
          <article key={match.context.id}>
            <span>{match.score}% similarity</span>
            <h3>{contextLabel(match.context)}</h3>
            <p>{match.context.project} · {formatRange(match.context.dateRange)}</p>
            <div className="chip-row">{match.reasons.map(reason => <span key={reason}>{reason}</span>)}</div>
            <div className="review-buttons">
              <button type="button" onClick={() => onSelect(match.context)}>Open</button>
              <button type="button" onClick={() => onPin({ type: 'cross-site-match', id: match.context.id, label: contextLabel(match.context), note: match.reasons.join(', ') })}>Pin match</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResearchNotebook({ pins, setPins, selectedContext }) {
  const [note, setNote] = useState('');
  const [collections, setCollections] = useState(() => local.get('astraea-notebook-collections', []));

  function addObservation() {
    if (!note.trim()) return;
    const next = [{ type: 'observation', id: `note-${Date.now()}`, label: selectedContext?.id || 'General observation', note, at: new Date().toLocaleString() }, ...pins];
    setPins(next);
    local.set('astraea-notebook-pins', next);
    setNote('');
  }

  function createCollection() {
    const collection = {
      id: `collection-${Date.now()}`,
      title: `Evidence Collection ${collections.length + 1}`,
      items: pins.slice(0, 5),
      at: new Date().toLocaleString(),
    };
    const next = [collection, ...collections].slice(0, 8);
    setCollections(next);
    local.set('astraea-notebook-collections', next);
  }

  function removePin(type, id) {
    const next = pins.filter(pin => `${pin.type}-${pin.id}` !== `${type}-${id}`);
    setPins(next);
    local.set('astraea-notebook-pins', next);
  }

  return (
    <section className="panel gold-frame" id="notebook">
      <div className="section-heading">
        <span>Research Notebook</span>
        <h2>Build Interpretations From Pinned Evidence</h2>
        <p>Pin hypotheses, anomalies, research gaps, cross-site matches, and observations. This becomes the working memory of the research process.</p>
      </div>
      <div className="notebook-layout">
        <aside>
          <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Write an observation, interpretation, doubt, or next step..." />
          <button type="button" onClick={addObservation}>Add observation</button>
          <button type="button" onClick={createCollection}>Create evidence collection</button>
        </aside>
        <div className="pin-board">
          {pins.length ? pins.map(pin => (
            <article key={`${pin.type}-${pin.id}`}>
              <span>{pin.type}</span>
              <h3>{pin.label}</h3>
              <p>{pin.note}</p>
              <button type="button" onClick={() => removePin(pin.type, pin.id)}>Remove</button>
            </article>
          )) : <p>No pinned evidence yet. Pin hypotheses, gaps, anomalies, and cross-site matches from the workspaces above.</p>}
        </div>
        <div className="collection-board">
          {collections.length ? collections.map(collection => (
            <article key={collection.id}>
              <span>{collection.at}</span>
              <h3>{collection.title}</h3>
              <p>{collection.items.length} pinned item(s)</p>
            </article>
          )) : <p>No evidence collections yet.</p>}
        </div>
      </div>
    </section>
  );
}

function DataLayerObjectives({ contexts, selectedContext, editorState, edgeReview, anomalyReview, manualRelationships }) {
  const layers = getEvidenceLayerObjectives({ contexts, selectedContext, editorState, reviewState: edgeReview, anomalyReview, manualRelationships });
  return (
    <section className="panel gold-frame" id="data-layers">
      <div className="section-heading">
        <span>Evidence Data Architecture</span>
        <h2>Eight Layers, Eight Objectives</h2>
        <p>Astraea now treats data as evidence objects. Each layer has a clear objective, measurable status, and output that feeds the final interpretation.</p>
      </div>
      <div className="layer-objective-grid">
        {layers.map(layer => (
          <article key={layer.id}>
            <div className="layer-head">
              <span>{layer.output}</span>
              <strong>{layer.readiness}%</strong>
            </div>
            <h3>{layer.title}</h3>
            <p>{layer.objective}</p>
            <small>{layer.status}</small>
            <div className="consistency-strip compact"><i style={{ width: `${layer.readiness}%` }} /></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvidenceObjectWorkbench({ selectedContext, edgeReview, anomalyReview, manualRelationships, editorState }) {
  const evidenceObject = buildEvidenceObject({ selectedContext, reviewState: edgeReview, anomalyReview, manualRelationships, editorState });
  const layers = [
    ['Source Evidence', `${evidenceObject.rawSourceEvidence.files.length} source files · ${evidenceObject.rawSourceEvidence.sampleRecords.length} sample records`],
    ['Canonical Context', `${evidenceObject.canonicalContext.id} · ${evidenceObject.canonicalContext.recordCount} records`],
    ['Relationships', `${evidenceObject.relationshipLayer.length} visible candidate edge(s)`],
    ['Chronology', `${Math.round(evidenceObject.chronologyLayer.low95)} to ${Math.round(evidenceObject.chronologyLayer.high95)} modeled 95% interval`],
    ['Anomalies', `${evidenceObject.anomalyLayer.length} selected-context signal(s)`],
    ['Interpretation', `${evidenceObject.interpretationLayer.consistencyScore}% · ${evidenceObject.interpretationLayer.level}`],
    ['Phase', `${evidenceObject.phaseLayer.name || 'Unassigned'} · ${evidenceObject.phaseLayer.range || 'unknown range'}`],
    ['Citation', `${evidenceObject.citationLayer.length} citation/source reference(s)`],
  ];

  function exportEvidenceObject() {
    downloadText(`${evidenceObject.id.toLowerCase()}.json`, JSON.stringify(evidenceObject, null, 2), 'application/json');
  }

  return (
    <section className="panel" id="evidence-object">
      <div className="section-heading">
        <span>Evidence Object Builder</span>
        <h2>Raw Row → Context → Claim</h2>
        <p>The selected context becomes a structured evidence object with source records, graph relationships, chronology, anomalies, phase assignment, and citations.</p>
      </div>
      <div className="evidence-object-layout">
        <article className="claim-card">
          <span>{evidenceObject.id}</span>
          <h3>{evidenceObject.claim}</h3>
          <p>{evidenceObject.objective}</p>
          <button type="button" onClick={exportEvidenceObject}>Export evidence object JSON</button>
        </article>
        <div className="pipeline-grid">
          {layers.map(([label, detail], index) => (
            <article key={label}>
              <strong>{index + 1}</strong>
              <span>{label}</span>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PhaseLayerWorkbench({ contexts, editorState, onSelect }) {
  const [phaseNotes, setPhaseNotes] = useState(() => local.get('astraea-phase-notes', {}));
  const phases = inferPhaseModel(contexts, editorState);

  function updatePhaseNote(id, note) {
    const next = { ...phaseNotes, [id]: note };
    setPhaseNotes(next);
    local.set('astraea-phase-notes', next);
  }

  return (
    <section className="panel gold-frame" id="phases">
      <div className="section-heading">
        <span>Phase Layer</span>
        <h2>From Contexts To Archaeological Phases</h2>
        <p>Group normalized contexts into interpretable phases. Each phase keeps a date range, objective, review count, selected contexts, and a local interpretation note.</p>
      </div>
      <div className="phase-grid">
        {phases.map(phase => (
          <article key={phase.id}>
            <span>{phase.range}</span>
            <h3>{phase.name}</h3>
            <p>{phase.objective}</p>
            <small>{number(phase.total)} contexts · {number(phase.reviewed)} reviewed locally</small>
            <textarea value={phaseNotes[phase.id] || ''} onChange={event => updatePhaseNote(phase.id, event.target.value)} placeholder="Phase interpretation note..." />
            <div className="phase-context-list">
              {phase.contexts.slice(0, 5).map(context => (
                <button type="button" key={context.id} onClick={() => onSelect(context)}>{context.id} · {contextLabel(context)}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SourceInventory() {
  const overview = researchData.reports.overview;
  return (
    <section className="panel gold-frame" id="source-inventory">
      <div className="section-heading">
        <span>Ingestion Layer</span>
        <h2>Source Inventory</h2>
        <p>Every source is normalized into Astraea's context, chronology, spatial, artifact, and methodology layers while retaining source identity.</p>
      </div>
      <div className="metric-grid">
        <MetricCard label="Open Context Rows" value={number(overview.totalOpenContextRows)} detail="Artifact, context, spatial, and zooarchaeology records." />
        <MetricCard label="Canonical Contexts" value={number(overview.totalCanonicalContexts)} detail="Aggregated context/layer records built from source hierarchy." />
        <MetricCard label="Radiocarbon Samples" value={number(overview.radiocarbonSamples)} detail="Oaxaca 14C samples with age, sigma, site, unit, and citation fields." />
        <MetricCard label="Mapped Records" value={number(overview.geoRecords)} detail="Open Context point records for spatial evidence review." />
      </div>
      <div className="source-grid">
        {researchData.openContext.sourceSummaries.map(source => (
          <article className="source-card" key={source.file}>
            <span>{source.sourceName}</span>
            <h3>{number(source.rows)} rows · {source.columns} columns</h3>
            <p>{source.role}</p>
            <small>{number(source.contexts)} context signatures · {number(source.geoRows)} georeferenced rows · {number(source.dateRows)} dated rows</small>
          </article>
        ))}
        <article className="source-card">
          <span>{researchData.radiocarbon.summary.file}</span>
          <h3>{number(researchData.radiocarbon.summary.records)} samples · median sigma {researchData.radiocarbon.summary.sigmaMedian}</h3>
          <p>{researchData.radiocarbon.summary.role}</p>
          <small>{number(researchData.radiocarbon.summary.citationRows)} citation rows · {number(researchData.radiocarbon.summary.siteUnitStratRows)} site/unit/strat rows</small>
        </article>
        <article className="source-card">
          <span>{researchData.harrisMethodology.file}</span>
          <h3>Harris Matrix methodology</h3>
          <p>{researchData.harrisMethodology.projectUse}</p>
          <small>{researchData.harrisMethodology.pages} pages extracted into Astraea's method notes.</small>
        </article>
      </div>
    </section>
  );
}

function ImportWorkbench() {
  const [result, setResult] = useState(null);

  function parseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (file.name.endsWith('.json')) {
        try {
          const json = JSON.parse(text);
          const rows = Array.isArray(json) ? json.length : Array.isArray(json.features) ? json.features.length : Object.keys(json).length;
          setResult({ name: file.name, type: 'JSON', rows, columns: Object.keys(Array.isArray(json) ? json[0] || {} : json.features?.[0]?.properties || json).slice(0, 12) });
        } catch {
          setResult({ name: file.name, type: 'JSON', rows: 0, columns: ['Invalid JSON'], error: true });
        }
        return;
      }
      const lines = text.split(/\r?\n/).filter(Boolean);
      const headers = lines[0]?.split(',').map(item => item.trim()) || [];
      setResult({ name: file.name, type: 'CSV/Text', rows: Math.max(0, lines.length - 1), columns: headers.slice(0, 18) });
    };
    reader.readAsText(file);
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <span>Import Workflow</span>
        <h2>CSV / JSON Intake</h2>
        <p>Drop in a source export to preview schema compatibility. The production pipeline also handles XLSX through the backend normalization script.</p>
      </div>
      <label className="file-drop">
        <input type="file" accept=".csv,.json,.txt" onChange={parseFile} />
        <strong>Choose source file</strong>
        <small>Schema preview appears here without replacing the integrated dataset.</small>
      </label>
      {result && (
        <div className={`import-result ${result.error ? 'danger' : ''}`}>
          <h3>{result.name}</h3>
          <p>{result.type} · {number(result.rows)} records detected</p>
          <div className="chip-row">{result.columns.map(column => <span key={column}>{column}</span>)}</div>
        </div>
      )}
    </section>
  );
}

function EvidenceMap({ contexts }) {
  const [activeLayer, setActiveLayer] = useState('both');
  const [selectedPoint, setSelectedPoint] = useState(null);
  const records = researchData.geoRecords.records.filter(record => record.coordinates).slice(0, 620);
  const contextPoints = contexts.filter(context => context.centroid).slice(0, 120);
  const visibleRecords = activeLayer === 'contexts' ? [] : records;
  const visibleContexts = activeLayer === 'records' ? [] : contextPoints;
  const allPoints = [...visibleRecords.map(item => item.coordinates), ...visibleContexts.map(item => item.centroid)];
  const lon = allPoints.map(point => point[0]);
  const lat = allPoints.map(point => point[1]);
  const minLon = lon.length ? Math.min(...lon) : 0;
  const maxLon = lon.length ? Math.max(...lon) : 1;
  const minLat = lat.length ? Math.min(...lat) : 0;
  const maxLat = lat.length ? Math.max(...lat) : 1;

  function x(point) {
    return ((point[0] - minLon) / Math.max(1e-6, maxLon - minLon)) * 100;
  }
  function y(point) {
    return 100 - ((point[1] - minLat) / Math.max(1e-6, maxLat - minLat)) * 100;
  }

  return (
    <section className="panel gold-frame">
      <div className="section-heading">
        <span>PostGIS-Style Spatial Model</span>
        <h2>Evidence Map</h2>
        <p>WGS84 points and context centroids are rendered as an interactive spatial evidence model. Click records or context clusters to inspect provenance.</p>
      </div>
      <div className="map-controls">
        {[
          ['both', 'All layers'],
          ['records', 'Field records'],
          ['contexts', 'Context centroids'],
        ].map(([value, label]) => (
          <button className={activeLayer === value ? 'active' : ''} type="button" key={value} onClick={() => setActiveLayer(value)}>{label}</button>
        ))}
      </div>
      <svg className="evidence-map" viewBox="0 0 100 100" role="img" aria-label="Spatial evidence map">
        <defs>
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#dfc579" strokeWidth="0.12" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        <rect x="2" y="2" width="96" height="96" className="map-frame" />
        {visibleRecords.map((record, index) => (
          <circle
            key={record.id || index}
            cx={x(record.coordinates)}
            cy={y(record.coordinates)}
            r="0.95"
            className={`map-dot ${selectedPoint?.id === record.id ? 'selected' : ''}`}
            onClick={() => setSelectedPoint({ kind: 'Mapped record', ...record })}
          />
        ))}
        {visibleContexts.map(context => (
          <circle
            key={context.id}
            cx={x(context.centroid)}
            cy={y(context.centroid)}
            r={Math.min(5.5, 1.8 + Math.log10(context.recordCount))}
            className={`map-context ${selectedPoint?.id === context.id ? 'selected' : ''}`}
            onClick={() => setSelectedPoint({ kind: 'Canonical context', ...context })}
          />
        ))}
      </svg>
      <div className="map-legend">
        <span><i className="legend-dot" /> {number(visibleRecords.length)} Open Context point records</span>
        <span><i className="legend-ring" /> {number(visibleContexts.length)} canonical context centroids</span>
      </div>
      <article className="map-detail">
        {selectedPoint ? (
          <>
            <span>{selectedPoint.kind}</span>
            <h3>{selectedPoint.label || selectedPoint.id}</h3>
            <p>{selectedPoint.context || contextLabel(selectedPoint)}</p>
            <div className="map-source-links">
              {selectedPoint.uri && <a href={selectedPoint.uri} target="_blank" rel="noreferrer">Open source record</a>}
              {selectedPoint.citationUri && <a href={selectedPoint.citationUri} target="_blank" rel="noreferrer">Open citation URI</a>}
              <small>{selectedPoint.sourceDataset || 'Source metadata retained in normalized evidence record.'}</small>
            </div>
          </>
        ) : (
          <>
            <span>Map interaction</span>
            <h3>Select a point</h3>
            <p>Click a field record or context centroid to inspect its label, source URI, citation URI, context path, and dataset layer.</p>
          </>
        )}
      </article>
    </section>
  );
}

function ContextExplorer({ contexts, selectedContext, onSelect, editorState, onEditorChange }) {
  const selected = selectedContext || contexts[0];
  const state = editorState[selected?.id] || { status: 'unreviewed', note: '' };
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Context / Layer Editor</span>
        <h2>Canonical Contexts</h2>
        <p>Review normalized contexts, update local interpretation notes, and preserve source-linked evidence.</p>
      </div>
      <div className="context-layout">
        <div className="context-list">
          {contexts.slice(0, 80).map(context => (
            <button className={selected?.id === context.id ? 'active' : ''} type="button" key={context.id} onClick={() => onSelect(context)}>
              <strong>{context.id}</strong>
              <span>{contextLabel(context)}</span>
              <small>{number(context.recordCount)} records · {Math.round(context.confidence)}% confidence</small>
            </button>
          ))}
        </div>
        {selected && (
          <article className="context-detail">
            <span>{selected.sourceDataset}</span>
            <h3>{contextLabel(selected)}</h3>
            <p>{selected.contextPath?.join(' → ') || 'No context path supplied.'}</p>
            <div className="detail-grid">
              <span><strong>Records</strong>{number(selected.recordCount)}</span>
              <span><strong>Date</strong>{formatRange(selected.dateRange)}</span>
              <span><strong>Feature</strong>{selected.feature || 'unlisted'}</span>
              <span><strong>Coordinates</strong>{selected.centroid ? selected.centroid.join(', ') : 'not supplied'}</span>
            </div>
            <div className="chip-row">
              {selected.taxa?.slice(0, 8).map(([name, count]) => <span key={name}>{name}: {number(count)}</span>)}
            </div>
            <label>
              Review Status
              <select value={state.status} onChange={event => onEditorChange(selected.id, { ...state, status: event.target.value })}>
                <option value="unreviewed">Unreviewed</option>
                <option value="accepted">Accepted context model</option>
                <option value="needs-field-check">Needs field check</option>
                <option value="contaminated">Possibly contaminated</option>
              </select>
            </label>
            <label>
              Research Note
              <textarea value={state.note} onChange={event => onEditorChange(selected.id, { ...state, note: event.target.value })} placeholder="Add interpretive notes, caveats, or source questions..." />
            </label>
          </article>
        )}
      </div>
    </section>
  );
}

function HarrisMatrixWorkbench({ contexts, reviewState, manualRelationships, onReview, onBulkReview, onAddManualRelationship, onDeleteManualRelationship, onExportReviewedEdges }) {
  const svgRef = useRef(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [manualForm, setManualForm] = useState({ source: '', target: '', type: 'manually linked above', note: '' });
  const graph = useMemo(() => getGraphModel(contexts, reviewState, manualRelationships), [contexts, reviewState, manualRelationships]);
  const selectedEdge = graph.relationships.find(edge => edge.id === selectedEdgeId) || graph.relationships[0];

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const width = 960;
    const height = 620;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes = graph.nodes.slice(0, 60).map((node, index) => ({
      ...node,
      x: 150 + (index % 5) * 165,
      y: 70 + Math.floor(index / 5) * 82,
    }));
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const edges = graph.relationships.filter(edge => nodeMap.has(edge.source) && nodeMap.has(edge.target)).slice(0, 90);

    svg.append('defs').append('marker')
      .attr('id', 'arrow-review')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#9b7a1f');

    function edgePath(edge) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) return '';
      const mid = (a.y + b.y) / 2;
      return `M${a.x},${a.y + 18} C${a.x + 40},${mid} ${b.x - 40},${mid} ${b.x},${b.y - 18}`;
    }

    const edgeSelection = svg.append('g').selectAll('path')
      .data(edges)
      .join('path')
      .attr('class', edge => `graph-edge ${edge.reviewStatus}`)
      .attr('d', edgePath)
      .on('click', (_, edge) => setSelectedEdgeId(edge.id))
      .attr('marker-end', 'url(#arrow-review)');

    const node = svg.append('g').selectAll('g')
      .data(nodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('class', 'graph-node')
      .style('cursor', 'grab')
      .call(
        d3.drag()
          .on('start', function () {
            d3.select(this).style('cursor', 'grabbing').raise();
          })
          .on('drag', function (event, d) {
            d.x = Math.max(42, Math.min(width - 42, event.x));
            d.y = Math.max(42, Math.min(height - 42, event.y));
            d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
            edgeSelection.attr('d', edgePath);
          })
          .on('end', function () {
            d3.select(this).style('cursor', 'grab');
          })
      );

    node.append('circle').attr('r', d => Math.min(28, 12 + Math.log10(d.recordCount + 1) * 6)).attr('fill', d => d.color);
    node.append('text').attr('text-anchor', 'middle').attr('dy', 4).text(d => d.id.replace('CTX-', 'C'));
    node.append('title').text(d => `${d.id}: ${d.site} · ${number(d.recordCount)} records · ${d.phase}`);
  }, [graph]);

  useEffect(() => {
    if (graph.relationships[0] && !graph.relationships.some(edge => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(graph.relationships[0].id);
    }
  }, [graph.relationships, selectedEdgeId]);

  function addManualRelationship() {
    if (!manualForm.source || !manualForm.target || manualForm.source === manualForm.target) return;
    onAddManualRelationship({
      id: `MAN-${Date.now()}`,
      source: manualForm.source,
      target: manualForm.target,
      type: manualForm.type,
      confidence: 0.68,
      basis: manualForm.note || 'Manual analyst-created relationship. Requires review before publication.',
    });
    setManualForm({ source: '', target: '', type: 'manually linked above', note: '' });
  }

  return (
    <section className="panel gold-frame">
      <div className="section-heading">
        <span>Harris Matrix Builder</span>
        <h2>Provisional Stratigraphic DAG</h2>
        <p>Drag contexts, create relationships, reject weak edges, and watch every decision reshape the chronology model downstream.</p>
      </div>
      <div className="graph-toolbar">
        <MetricCard label="Graph Scope" value={graph.scope} detail={`${number(graph.visibleContextCount)} filtered contexts · ${number(graph.totalCandidateEdges)} available candidate edges`} />
        <MetricCard label="Visible Nodes" value={number(graph.nodes.length)} detail="Contexts participating in currently drawn provisional relationships." />
        <MetricCard label="Visible Edges" value={number(graph.relationships.length)} detail={`${number(manualRelationships.length)} analyst-created edges included.`} />
      </div>
      <svg ref={svgRef} className="harris-svg" role="img" aria-label="Astraea provisional Harris Matrix graph" />
      {selectedEdge && (
        <article className="edge-inspector">
          <span>{selectedEdge.manual ? 'Analyst-created edge' : 'Inferred candidate edge'}</span>
          <h3>{selectedEdge.source} → {selectedEdge.target}</h3>
          <p>{selectedEdge.type} · confidence {Math.round((selectedEdge.confidence || 0) * 100)}%</p>
          <small>{selectedEdge.basis}</small>
          <div className="review-buttons">
            {['accepted', 'rejected', 'pending'].map(status => (
              <button className={selectedEdge.reviewStatus === status ? 'active' : ''} type="button" key={status} onClick={() => onReview(selectedEdge.id, status)}>{status}</button>
            ))}
            {selectedEdge.manual && (
              <button type="button" onClick={() => onDeleteManualRelationship(selectedEdge.id)}>Delete manual edge</button>
            )}
          </div>
        </article>
      )}
      <div className="manual-edge-form">
        <select value={manualForm.source} onChange={event => setManualForm({ ...manualForm, source: event.target.value })}>
          <option value="">Source context</option>
          {graph.nodes.map(node => <option value={node.id} key={`source-${node.id}`}>{node.id} · {node.site}</option>)}
        </select>
        <select value={manualForm.target} onChange={event => setManualForm({ ...manualForm, target: event.target.value })}>
          <option value="">Target context</option>
          {graph.nodes.map(node => <option value={node.id} key={`target-${node.id}`}>{node.id} · {node.site}</option>)}
        </select>
        <select value={manualForm.type} onChange={event => setManualForm({ ...manualForm, type: event.target.value })}>
          <option>manually linked above</option>
          <option>possibly cuts</option>
          <option>possibly fills</option>
          <option>possibly contemporary with</option>
        </select>
        <input value={manualForm.note} onChange={event => setManualForm({ ...manualForm, note: event.target.value })} placeholder="Evidence note for manual relationship..." />
        <button type="button" onClick={addManualRelationship}>Add relationship</button>
      </div>
      <div className="action-row">
        <button type="button" onClick={() => onBulkReview(graph.relationships.map(edge => edge.id), 'accepted')}>Accept visible edges</button>
        <button type="button" onClick={() => onBulkReview(graph.relationships.map(edge => edge.id), 'pending')}>Reset visible edges</button>
        <button type="button" onClick={() => onExportReviewedEdges(graph.relationships)}>Download reviewed edge table</button>
      </div>
      <div className="edge-review">
        {graph.relationships.slice(0, 10).map(edge => (
          <article key={edge.id}>
            <strong>{edge.source} → {edge.target}</strong>
            <p>{edge.basis}</p>
            <div className="review-buttons">
              {['accepted', 'rejected', 'pending'].map(status => (
                <button className={edge.reviewStatus === status ? 'active' : ''} type="button" key={status} onClick={() => onReview(edge.id, status)}>{status}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChronologyLab({ site }) {
  const chronology = chronologyForSite(site);
  const records = chronology.records;
  const maxAge = Math.max(1, chronology.max);
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Radiocarbon Laboratory</span>
        <h2>Dating Uncertainty Visualizer</h2>
        <p>Oaxaca 14C samples are visualized with normalized age, sigma, sample material, and review flags. Bands are uncalibrated display ranges.</p>
      </div>
      <div className="chronology-summary">
        <MetricCard label="Visible Samples" value={number(records.length)} detail={site ? `Filtered to ${site}` : 'Showing cross-site chronology sample.'} />
        <MetricCard label="Flagged Samples" value={number(chronology.flagged)} detail="Old wood, sediment/bulk, wide sigma, or weak association." />
        <MetricCard label="Age Range" value={`${number(chronology.min)}–${number(chronology.max)} BP`} detail="Normalized radiocarbon age range in visible records." />
      </div>
      <div className="date-bars">
        {records.slice(0, 55).map(record => {
          const left = 100 - (record.normalizedAge / maxAge) * 100;
          const width = Math.max(1.2, ((record.normalizedSigma || 45) * 4 / maxAge) * 100);
          return (
            <article key={`${record.labNumber}-${record.siteName}`}>
              <div>
                <strong>{record.labNumber}</strong>
                <span>{record.siteName} · {record.stratigraphicUnit || record.excavationUnit || 'unassigned stratigraphy'}</span>
              </div>
              <div className="date-track"><i style={{ left: `${Math.max(0, left - width / 2)}%`, width: `${width}%` }} /></div>
              <small>{number(record.normalizedAge)} ± {record.normalizedSigma || '?'} BP · {record.material || 'unknown material'}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MissingLinkLab({ selectedContext, contexts, reviewState, manualRelationships, onAddManualRelationship }) {
  const [created, setCreated] = useState('');
  const candidates = getMissingLinkCandidates(selectedContext, contexts, reviewState, manualRelationships);

  function acceptCandidate(candidate) {
    const [source, target] = candidate.direction.split(' → ');
    const edge = {
      id: `PRED-${Date.now()}`,
      source,
      target,
      type: candidate.type,
      confidence: candidate.confidence,
      basis: `Missing-link prediction: ${candidate.rationale}. Accepted from Astraea's reconciliation lab for expert review.`,
    };
    onAddManualRelationship(edge);
    setCreated(`${source} → ${target}`);
  }

  return (
    <section className="panel gold-frame" id="missing-links">
      <div className="section-heading">
        <span>ST-GNN-Style Missing Link Lab</span>
        <h2>Predict Disconnected Stratigraphic Edges</h2>
        <p>Rank possible relationships between the selected context and nearby contexts. These are graph-reconciliation hypotheses, not source facts.</p>
      </div>
      <div className="link-lab-header">
        <MetricCard label="Anchor Context" value={selectedContext?.id || 'None'} detail={selectedContext ? contextLabel(selectedContext) : 'Select a context to generate candidates.'} />
        <MetricCard label="Candidate Links" value={number(candidates.length)} detail="Ranked by site, area, unit, date proximity, record density, and context confidence." />
        <MetricCard label="Last Accepted" value={created || 'None'} detail="Accepted candidates are added to the analyst-created provisional DAG layer." />
      </div>
      <div className="candidate-grid">
        {candidates.map(candidate => (
          <article key={candidate.context.id}>
            <span>{candidate.type} · {Math.round(candidate.confidence * 100)}%</span>
            <h3>{candidate.direction}</h3>
            <p>{contextLabel(candidate.context)}</p>
            <small>{candidate.rationale}</small>
            <div className="consistency-strip compact"><i style={{ width: `${Math.round(candidate.confidence * 100)}%` }} /></div>
            <button type="button" onClick={() => acceptCandidate(candidate)}>Add to provisional DAG</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChronologyPropagationWorkbench({ contexts, selectedContext }) {
  const model = getMultiContextChronologyModel(contexts, selectedContext);
  const [focus, setFocus] = useState('all');
  const visibleTracks = focus === 'calibrated'
    ? model.calibratedTracks
    : focus === 'contexts'
      ? model.contextTracks
      : focus === 'radiocarbon'
        ? model.radiocarbonTracks
        : model.tracks;
  const years = model.tracks.flatMap(track => [track.posterior.low95, track.posterior.high95]).filter(Number.isFinite);
  const minYear = years.length ? Math.min(...years) : -8000;
  const maxYear = years.length ? Math.max(...years) : 1000;
  const span = Math.max(1, maxYear - minYear);
  const graphTracks = visibleTracks.filter(track => track.points?.length).slice(0, 10);
  const densityPaths = graphTracks.map((track, trackIndex) => {
    const maxDensity = Math.max(...track.points.map(point => point.density), 1);
    const d = track.points.map((point, index) => {
      const x = ((point.year - minYear) / span) * 100;
      const y = 92 - (point.density / maxDensity) * (track.kind === 'radiocarbon-site' ? 64 : 44);
      return `${index === 0 ? 'M' : 'L'} ${Math.max(0, Math.min(100, x)).toFixed(2)} ${Math.max(8, Math.min(92, y)).toFixed(2)}`;
    }).join(' ');
    return { track, d, trackIndex };
  });

  return (
    <section className="panel" id="bayesian">
      <div className="section-heading">
        <span>Chronology MCMC</span>
        <h2>Multi-Context Chronology Model</h2>
        <p>{model.explanation}</p>
      </div>
      <div className="chronology-summary">
        <MetricCard label="Chronology Tracks" value={number(model.stats.totalTracks)} detail={`${number(model.stats.archaeologicalContexts)} contexts · ${number(model.stats.radiocarbonSites)} radiocarbon site clusters`} />
        <MetricCard label="Curve-Calibrated Tracks" value={number(model.stats.curveCalibratedTracks)} detail="Tracks with IntCal20, SHCal20, or Marine20 likelihoods." />
        <MetricCard label="Retained MCMC Samples" value={number(model.stats.retainedSamples)} detail="Combined retained samples across visible chronology tracks." />
        <MetricCard label="Sequence Gaps" value={number(model.sequenceGaps.length)} detail="Large temporal gaps between adjacent posterior intervals." />
      </div>
      <div className="mcmc-density-panel">
        <div className="section-heading">
          <span>MCMC posterior graph</span>
          <h2>Probability Curves Across Contexts</h2>
          <p>Each line is a retained-sample density curve for one chronology track. Taller/narrower curves mean tighter date probability; flatter curves mean broader uncertainty.</p>
        </div>
        <svg viewBox="0 0 100 100" role="img" aria-label="Multi-context MCMC posterior density graph">
          <path d="M0 92 H100" className="axis-line" />
          {[0, 0.25, 0.5, 0.75, 1].map(mark => (
            <g key={mark}>
              <path d={`M${mark * 100} 10 V92`} className="density-grid-line" />
              <text x={mark * 100} y="98" textAnchor={mark === 0 ? 'start' : mark === 1 ? 'end' : 'middle'}>{formatYear(minYear + span * mark)}</text>
            </g>
          ))}
          {densityPaths.map(item => (
            <path
              key={`${item.track.kind}-${item.track.id}`}
              d={item.d}
              className={`density-line density-${item.track.kind}`}
              style={{ opacity: Math.max(0.34, 1 - item.trackIndex * 0.055) }}
            />
          ))}
        </svg>
        <div className="density-legend">
          {graphTracks.slice(0, 6).map(track => (
            <span key={`legend-${track.kind}-${track.id}`}>{track.kind === 'radiocarbon-site' ? '14C' : 'CTX'} · {track.label}</span>
          ))}
        </div>
      </div>
      <div className="map-controls">
        {[
          ['all', 'All tracks'],
          ['contexts', 'Archaeological contexts'],
          ['radiocarbon', '14C site clusters'],
          ['calibrated', 'Curve-calibrated only'],
        ].map(([id, label]) => (
          <button className={focus === id ? 'active' : ''} type="button" key={id} onClick={() => setFocus(id)}>{label}</button>
        ))}
      </div>
      <div className="multi-chronology-layout">
        <div className="chronology-track-list">
          {visibleTracks.map(track => {
            const left = ((track.posterior.low95 - minYear) / span) * 100;
            const width = Math.max(1.8, ((track.posterior.high95 - track.posterior.low95) / span) * 100);
            const median = ((track.posterior.center - minYear) / span) * 100;
            return (
              <article key={`${track.kind}-${track.id}`} className={track.kind}>
                <div className="track-copy">
                  <span>{track.kind === 'radiocarbon-site' ? '14C site cluster' : 'archaeological context'}</span>
                  <h3>{track.label}</h3>
                  <p>{formatYear(track.posterior.low95)} to {formatYear(track.posterior.high95)} · median {formatYear(track.posterior.center)}</p>
                  <small>{track.supportLevel} · {number(track.related.length)} radiocarbon input(s) · {Math.round(track.diagnostics.acceptanceRate * 100)}% MCMC acceptance</small>
                </div>
                <div className="track-axis" aria-label={`${track.label} chronology interval`}>
                  <i style={{ left: `${left}%`, width: `${width}%` }} />
                  <b style={{ left: `${median}%` }} />
                </div>
              </article>
            );
          })}
        </div>
        <aside className="chronology-insights">
          <div>
            <span>Loaded calibration curves</span>
            {calibrationCurveSummaries.map(curve => (
              <p key={curve.id}><strong>{curve.id}</strong> · {number(curve.rows)} rows · {curve.minCalBp} to {curve.maxCalBp} cal BP</p>
            ))}
          </div>
          <div>
            <span>High uncertainty tracks</span>
            {model.highUncertainty.length ? model.highUncertainty.map(track => (
              <p key={`uncertain-${track.kind}-${track.id}`}><strong>{track.label}</strong> · {formatYear(track.posterior.low95)} to {formatYear(track.posterior.high95)}</p>
            )) : <p>No high-uncertainty tracks in the current model.</p>}
          </div>
          <div>
            <span>Large sequence gaps</span>
            {model.sequenceGaps.length ? model.sequenceGaps.map(gap => (
              <p key={`${gap.from.id}-${gap.to.id}`}><strong>{number(Math.round(gap.gap))} years</strong> between {gap.from.label} and {gap.to.label}</p>
            )) : <p>No large gaps between adjacent posterior intervals.</p>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function AnomalyQueue({ reviewState, onReview }) {
  const anomalies = researchData.reports.anomalies.slice(0, 90);
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Anomaly Review Queue</span>
        <h2>Taphonomic + Chronology Signals</h2>
        <p>Signals are triage prompts for expert review. They do not automatically revise the archaeological interpretation.</p>
      </div>
      <div className="anomaly-list">
        {anomalies.map((item, index) => {
          const id = `${item.record}-${index}`;
          const status = reviewState[id] || 'open';
          return (
            <article className={status} key={id}>
              <span>{item.type} · severity {item.severity}</span>
              <h3>{item.record || item.context}</h3>
              <p>{item.evidence}</p>
              <small>{item.site} · {item.source}</small>
              <div className="review-buttons">
                {['open', 'accepted', 'dismissed'].map(value => (
                  <button className={status === value ? 'active' : ''} type="button" key={value} onClick={() => onReview(id, value)}>{value}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EvidenceLedger({ selectedContext }) {
  const context = selectedContext || researchData.openContext.contexts[0];
  return (
    <section className="panel gold-frame">
      <div className="section-heading">
        <span>Evidence Ledger</span>
        <h2>Source-Aware Record View</h2>
        <p>Every context keeps its source files, record samples, taxonomy/material signatures, dates, coordinates, and review notes separate from Astraea's interpretation.</p>
      </div>
      <article className="ledger-card">
        <span>{context.id}</span>
        <h3>{contextLabel(context)}</h3>
        <p>{context.contextPath?.join(' → ')}</p>
        <div className="detail-grid">
          <span><strong>Source</strong>{context.sourceDataset}</span>
          <span><strong>Files</strong>{context.sourceFiles?.map(sourceShortName).join(', ')}</span>
          <span><strong>Materials</strong>{context.materials?.slice(0, 4).map(([a, b]) => `${a} ${b}`).join('; ') || 'none'}</span>
          <span><strong>Categories</strong>{context.artifactCategories?.map(([a, b]) => `${a} ${b}`).join('; ')}</span>
        </div>
        <h4>Sample Records</h4>
        <div className="sample-grid">
          {context.sampleRecords?.map(record => (
            <div key={record.uri || record.label}>
              <strong>{record.label}</strong>
              <small>{record.category} · {record.taxon || record.material || 'unclassified'} · {formatRange(record.dateRange)}</small>
              {record.uri && <a href={record.uri} target="_blank" rel="noreferrer">Open source URI</a>}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function CitationCenter() {
  const [copied, setCopied] = useState('');
  const [category, setCategory] = useState('all');
  const calibrationCitationRecords = calibrationCurveSummaries.map(curve => ({
    type: 'Calibration Curve',
    label: curve.label,
    citation: curve.citation,
    use: `Used by Astraea's curve-calibrated MCMC chronology sampler. Curve range: ${curve.minCalBp} to ${curve.maxCalBp} cal BP; ${number(curve.rows)} rows loaded.`,
  }));
  const allCitationRecords = [...actualCitationRecords, ...calibrationCitationRecords];
  const visibleActualCitations = allCitationRecords.filter(item => category === 'all' || item.type === category);
  const categories = ['all', ...new Set(allCitationRecords.map(item => item.type))];
  function copyCitation(item) {
    navigator.clipboard?.writeText(item.citation);
    setCopied(item.label);
  }

  return (
    <section className="panel gold-frame" id="citations">
      <div className="section-heading">
        <span>Provenance + Citation</span>
        <h2>Citation Center</h2>
        <p>Astraea surfaces dataset-derived citations, calibration curve citations, Open Context record/citation URIs, radiocarbon bibliography strings, and the Harris Matrix methodology reference. Use these for source evidence and cite Astraea only for the software/reconciliation layer.</p>
      </div>
      <div className="map-controls">
        {categories.map(item => (
          <button className={category === item ? 'active' : ''} key={item} type="button" onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      <div className="citation-grid">
        {visibleActualCitations.map(item => (
          <article key={item.label}>
            <strong>{item.type}</strong>
            <span>{item.label}</span>
            <p>{item.citation}</p>
            <small>{item.use}</small>
            <div className="source-link-row">
              {item.uri && <a href={item.uri} target="_blank" rel="noreferrer">Source record</a>}
              {item.citationUri && <a href={item.citationUri} target="_blank" rel="noreferrer">Citation URI</a>}
            </div>
            <button type="button" onClick={() => copyCitation(item)}>{copied === item.label ? 'Copied' : 'Copy citation note'}</button>
          </article>
        ))}
      </div>
      <details className="citation-method-note">
        <summary>Repository-level citation safety notes</summary>
        <div className="citation-grid">
          {citationRecords.map(item => (
            <article key={item.label}>
              <span>{item.label}</span>
              <p>{item.citation}</p>
              <small>{item.use}</small>
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}

function ActionWorkbench({ selectedContext }) {
  const [log, setLog] = useState(() => local.get('astraea-action-log', []));
  const context = selectedContext || researchData.openContext.contexts[0];
  const actions = [
    {
      label: 'Ask what changed here',
      result: `${context.id}: ${contextLabel(context)} contains ${number(context.recordCount)} normalized source records across ${context.sourceFiles?.length || 0} source layer(s). The first research move is to compare its material signature against adjacent contexts and ask whether this represents deposition, disturbance, reuse, or a phase transition.`,
    },
    {
      label: 'Challenge the context label',
      result: `Challenge opened for ${context.id}: verify whether unit, stratum, feature, and depositional labels describe the same archaeological event or accidentally combine evidence from separate interpretive units.`,
    },
    {
      label: 'Test source reliability',
      result: `Reliability test for ${context.id}: compare repository URIs, sample rows, coordinate availability, and dataset provenance before promoting this context from evidence cluster to interpretive claim.`,
    },
    {
      label: 'Search for missing links',
      result: `Missing-link prompt for ${context.id}: look for contexts from the same site with overlapping path labels, nearby dates, shared materials, or complementary cut/fill language, then add only relationships the evidence can defend.`,
    },
    {
      label: 'Stress-test chronology',
      result: `Chronology stress test for ${context.id}: current range is ${formatRange(context.dateRange)}. Check whether artifact dating, radiocarbon bands, and stratigraphic position agree or whether one evidence class is pulling the model too strongly.`,
    },
    {
      label: 'Probe matrix consequence',
      result: `Matrix consequence for ${context.id}: accepting an edge should change not just a line on the graph, but the chronological story. Review how any proposed above/below/cuts/fills claim shifts phase assignment and uncertainty.`,
    },
  ];
  function run(action) {
    const next = [{ label: action.label, result: action.result, at: new Date().toLocaleString() }, ...log].slice(0, 10);
    setLog(next);
    local.set('astraea-action-log', next);
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Research Operations</span>
        <h2>Context Decision Desk</h2>
        <p>Run active research prompts on the selected context. Each action creates an interpretive trace: a question, a stress test, or a challenge to the current model.</p>
      </div>
      <div className="action-row">
        {actions.map(action => <button type="button" key={action.label} onClick={() => run(action)}>{action.label}</button>)}
      </div>
      <div className="action-log">
        {log.length ? log.map(item => (
          <article key={`${item.at}-${item.label}`}>
            <span>{item.at}</span>
            <h3>{item.label}</h3>
            <p>{item.result}</p>
          </article>
        )) : <p>No actions yet. Select a context and run a research action.</p>}
      </div>
    </section>
  );
}

function parseFieldJournal(text) {
  const lower = text.toLowerCase();
  const contextMatches = [...text.matchAll(/\b(?:context|locus|unit|su|strat(?:um)?|layer)\s*[:#-]?\s*([a-z0-9._-]+)/gi)].map(match => match[0]);
  const relationshipTerms = [
    ['covers', lower.includes('covers') || lower.includes('covered')],
    ['cuts', lower.includes('cuts') || lower.includes('cut by')],
    ['fills', lower.includes('fills') || lower.includes('fill of')],
    ['below / above', lower.includes('below') || lower.includes('above')],
    ['contemporary', lower.includes('contemporary') || lower.includes('same phase')],
  ].filter(([, present]) => present).map(([label]) => label);
  const materials = ['charcoal', 'bone', 'shell', 'ceramic', 'pottery', 'obsidian', 'stone', 'metal', 'glass'].filter(term => lower.includes(term));
  const risks = [
    ['possible intrusion', lower.includes('intrusive') || lower.includes('intrusion')],
    ['bioturbation risk', lower.includes('bioturb') || lower.includes('root') || lower.includes('burrow')],
    ['uncertain relationship', lower.includes('uncertain') || lower.includes('unclear')],
    ['chronology cue', /\b(?:bce|ce|bp|radiocarbon|14c)\b/i.test(text)],
  ].filter(([, present]) => present).map(([label]) => label);
  return {
    contexts: contextMatches.slice(0, 12),
    relationships: relationshipTerms,
    materials,
    risks,
    summary: contextMatches.length
      ? `Detected ${contextMatches.length} context/layer references, ${relationshipTerms.length} relationship cues, and ${materials.length} material classes.`
      : 'No explicit context labels detected; add locus, unit, strat, layer, or SU labels for stronger parsing.',
  };
}

function FieldJournalParser({ selectedContext }) {
  const [text, setText] = useState('Unit 10396 appears below layer 10395. Charcoal and animal bone recovered near the east section. Relationship uncertain because roots disturbed the upper fill.');
  const [saved, setSaved] = useState(() => local.get('astraea-parser-notes', []));
  const parsed = parseFieldJournal(text);

  function saveParse() {
    const entry = {
      at: new Date().toLocaleString(),
      context: selectedContext?.id || 'unassigned',
      summary: parsed.summary,
      risks: parsed.risks.join(', ') || 'none',
    };
    const next = [entry, ...saved].slice(0, 8);
    setSaved(next);
    local.set('astraea-parser-notes', next);
  }

  return (
    <section className="panel" id="parser">
      <div className="section-heading">
        <span>Field Journal Intelligence</span>
        <h2>Context Note Parser</h2>
        <p>Paste a field note or trench diary excerpt. Astraea extracts candidate context labels, relationship cues, materials, and risk flags for review.</p>
      </div>
      <div className="parser-layout">
        <textarea value={text} onChange={event => setText(event.target.value)} />
        <aside className="parser-output">
          <h3>{parsed.summary}</h3>
          <div className="chip-row">
            {['contexts', 'relationships', 'materials', 'risks'].flatMap(key => parsed[key].map(item => <span key={`${key}-${item}`}>{key}: {item}</span>))}
          </div>
          <button type="button" onClick={saveParse}>Save parsed note</button>
        </aside>
      </div>
      <div className="mini-list">
        {saved.length ? saved.map(item => <p key={`${item.at}-${item.context}`}><strong>{item.context}</strong> · {item.summary} · risks: {item.risks}</p>) : <p>No parsed journal notes saved yet.</p>}
      </div>
    </section>
  );
}

function PublicationComposer({ selectedContext, edgeReview, anomalyReview, onExport }) {
  const [sectionSet, setSectionSet] = useState('technical');
  const score = stratigraphicConsistencyScore(selectedContext, edgeReview, anomalyReview);
  const acceptedEdges = Object.values(edgeReview).filter(status => status === 'accepted').length;
  const acceptedAnomalies = Object.values(anomalyReview).filter(status => status === 'accepted').length;
  const templates = {
    technical: 'Technical Appendix',
    public: 'Museum / Outreach Summary',
    dissertation: 'Dissertation Evidence Note',
  };
  const preview = [
    `${templates[sectionSet]} for ${selectedContext?.id || 'selected context'}`,
    `Context: ${selectedContext ? contextLabel(selectedContext) : 'No context selected'}`,
    `Stratigraphic Consistency Score: ${score.score}% (${score.level})`,
    `Evidence rows: ${number(selectedContext?.recordCount || 0)}`,
    `Accepted provisional edges: ${acceptedEdges}`,
    `Accepted anomaly signals: ${acceptedAnomalies}`,
    `Citation practice: cite source URIs for evidence and Astraea for reconciliation workflow only.`,
  ].join('\n');

  function exportComposerPacket() {
    downloadText('astraea-publication-packet.md', preview, 'text/markdown');
  }

  return (
    <section className="panel gold-frame">
      <div className="section-heading">
        <span>Publication Workbench</span>
        <h2>Evidence Packet Composer</h2>
        <p>Assemble a defensible output that separates source evidence, provisional machine suggestions, human review decisions, and citation cautions.</p>
      </div>
      <div className="publication-layout">
        <aside>
          <label>
            Output mode
            <select value={sectionSet} onChange={event => setSectionSet(event.target.value)}>
              <option value="technical">Technical Appendix</option>
              <option value="public">Museum / Outreach Summary</option>
              <option value="dissertation">Dissertation Evidence Note</option>
            </select>
          </label>
          <button type="button" onClick={exportComposerPacket}>Export packet</button>
          <button type="button" onClick={onExport}>Export full evidence report</button>
        </aside>
        <pre>{preview}</pre>
      </div>
    </section>
  );
}

function TrenchComparison({ leftSite, rightSite, onLeft, onRight }) {
  const comparisons = compareSites(leftSite, rightSite);
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Trench / Site Comparison</span>
        <h2>Comparative Workspace</h2>
        <p>Compare context density, records, chronology, and artifact signatures between two sites or excavation areas.</p>
      </div>
      <div className="selector-row">
        <select value={leftSite} onChange={event => onLeft(event.target.value)}>{siteOptions.map(site => <option key={site}>{site}</option>)}</select>
        <select value={rightSite} onChange={event => onRight(event.target.value)}>{siteOptions.map(site => <option key={site}>{site}</option>)}</select>
      </div>
      <div className="compare-grid">
        {comparisons.map(item => (
          <article key={item.site}>
            <span>{item.site}</span>
            <h3>{number(item.records)} records</h3>
            <p>{number(item.contexts)} contexts · {number(item.radiocarbon)} radiocarbon samples · {formatRange(item.dateSpan.map(v => Number.isFinite(v) ? v : null))}</p>
            <div className="chip-row">{item.topTaxa.slice(0, 7).map(([name, count]) => <span key={name}>{name}: {number(count)}</span>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MLSuggestions() {
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Machine-Assisted Layer</span>
        <h2>Suggestions, Not Truth</h2>
        <p>ST-GNN-style suggestions are clearly labeled as provisional. Astraea assists interpretation; it does not replace archaeological judgement.</p>
      </div>
      <div className="suggestion-grid">
        {researchData.reports.mlSuggestions.slice(0, 24).map(item => (
          <article key={item.id}>
            <span>{item.kind}</span>
            <h3>{item.target}</h3>
            <p>{item.recommendation}</p>
            <small>{pct(item.confidence)} confidence · {item.status}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function PhotogrammetryRegister() {
  const [items, setItems] = useState(() => local.get('astraea-photogrammetry', [
    { label: 'Trench 5 photogrammetry mesh', reference: 'Add 3D mesh / photogrammetry URL', status: 'awaiting source file' },
  ]));
  const [draft, setDraft] = useState({ label: '', reference: '' });
  function addItem() {
    if (!draft.label.trim()) return;
    const next = [{ ...draft, status: 'registered evidence reference' }, ...items];
    setItems(next);
    local.set('astraea-photogrammetry', next);
    setDraft({ label: '', reference: '' });
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <span>3D / Photogrammetry</span>
        <h2>Reference Register</h2>
        <p>Track meshes, orthoimages, section drawings, and photogrammetry references alongside the context graph.</p>
      </div>
      <div className="input-row">
        <input value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })} placeholder="Reference label" />
        <input value={draft.reference} onChange={event => setDraft({ ...draft, reference: event.target.value })} placeholder="URL, filename, or archive note" />
        <button type="button" onClick={addItem}>Add</button>
      </div>
      <div className="mini-list">{items.map(item => <p key={`${item.label}-${item.reference}`}><strong>{item.label}</strong> · {item.reference} · {item.status}</p>)}</div>
    </section>
  );
}

function BackendStatus() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getApiHealth().then(setHealth).catch(err => setError(err.message));
  }, []);
  return (
    <section className="panel">
      <div className="section-heading">
        <span>FastAPI Research Service</span>
        <h2>Backend Console</h2>
        <p>The frontend can run from the embedded normalized dataset. When FastAPI is running, these same data are exposed through research endpoints.</p>
      </div>
      {health ? (
        <div className="backend-ok">
          <strong>Backend online</strong>
          <p>{number(health.dataset?.open_context_rows)} Open Context rows · {number(health.dataset?.radiocarbon_samples)} 14C samples · {number(health.dataset?.geo_records)} mapped records</p>
        </div>
      ) : (
        <div className="backend-warn">
          <strong>Backend unavailable</strong>
          <p>{error || 'Start FastAPI to use API-backed endpoints. The research workspace remains usable from local normalized data.'}</p>
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [filters, setFilters] = useState({ query: '', site: '', project: '', source: '' });
  const [selectedContext, setSelectedContext] = useState(null);
  const [editorState, setEditorState] = useState(() => local.get('astraea-context-editor', {}));
  const [edgeReview, setEdgeReview] = useState(() => local.get('astraea-edge-review', {}));
  const [anomalyReview, setAnomalyReview] = useState(() => local.get('astraea-anomaly-review', {}));
  const [manualRelationships, setManualRelationships] = useState(() => local.get('astraea-manual-relationships', []));
  const [notebookPins, setNotebookPins] = useState(() => local.get('astraea-notebook-pins', []));
  const [leftSite, setLeftSite] = useState(siteOptions[0] || '');
  const [rightSite, setRightSite] = useState(siteOptions[1] || siteOptions[0] || '');

  const contexts = useMemo(() => filterContexts(filters), [filters]);
  const selected = selectedContext || contexts[0] || researchData.openContext.contexts[0];

  useEffect(() => {
    if (selectedContext && !contexts.some(context => context.id === selectedContext.id)) {
      setSelectedContext(contexts[0] || null);
    }
  }, [contexts, selectedContext]);

  function updateContext(id, value) {
    const next = { ...editorState, [id]: value };
    setEditorState(next);
    local.set('astraea-context-editor', next);
  }

  function updateEdge(id, status) {
    const next = { ...edgeReview, [id]: status };
    setEdgeReview(next);
    local.set('astraea-edge-review', next);
  }

  function bulkUpdateEdges(ids, status) {
    const next = { ...edgeReview };
    ids.forEach(id => {
      next[id] = status;
    });
    setEdgeReview(next);
    local.set('astraea-edge-review', next);
  }

  function addManualRelationship(edge) {
    const next = [edge, ...manualRelationships].slice(0, 80);
    setManualRelationships(next);
    local.set('astraea-manual-relationships', next);
  }

  function deleteManualRelationship(id) {
    const next = manualRelationships.filter(edge => edge.id !== id);
    setManualRelationships(next);
    local.set('astraea-manual-relationships', next);
  }

  function exportReviewedEdges(edges) {
    const rows = [
      'id,source,target,type,confidence,reviewStatus,manual,basis',
      ...edges.map(edge => [
        edge.id,
        edge.source,
        edge.target,
        edge.type,
        edge.confidence,
        edgeReview[edge.id] || edge.reviewStatus || 'pending',
        edge.manual ? 'yes' : 'no',
        `"${String(edge.basis || '').replaceAll('"', '""')}"`,
      ].join(',')),
    ].join('\n');
    downloadText('astraea-reviewed-provisional-edges.csv', rows, 'text/csv');
  }

  function updateAnomaly(id, status) {
    const next = { ...anomalyReview, [id]: status };
    setAnomalyReview(next);
    local.set('astraea-anomaly-review', next);
  }

  function pinEvidence(item) {
    const next = [{ ...item, at: new Date().toLocaleString() }, ...notebookPins.filter(pin => `${pin.type}-${pin.id}` !== `${item.type}-${item.id}`)].slice(0, 40);
    setNotebookPins(next);
    local.set('astraea-notebook-pins', next);
  }

  function exportReport() {
    downloadText('astraea-evidence-report.md', buildMarkdownReport({ selectedContext: selected, reviewState: edgeReview }));
  }

  function openGenerator() {
    document.querySelector('#generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <nav>
          <a href="#guide">Guide</a>
          <a href="#generator">Generate</a>
          <a href="#evidence">Evidence</a>
          <a href="#matrix">Matrix</a>
          <a href="#notebook">Notebook</a>
          <a href="#sources">Sources</a>
        </nav>
        <div className="hero-grid">
          <div>
            <span className="eyebrow">Computational Archaeology · Open Context · Harris Matrix · Radiocarbon</span>
            <h1>Astraea</h1>
            <h2>Stratigraphic Reconciliation & Anomaly Engine</h2>
            <p>
              A computational archaeology workspace that turns excavation records, artifact logs, stratigraphic relationships, and radiocarbon data into generated research case files. Astraea compares evidence across sites, models contexts as reviewable Harris Matrix-style graph relationships, runs multi-context curve-calibrated MCMC chronology with IntCal20, SHCal20, and Marine20, and surfaces anomaly signals for expert interpretation.
            </p>
            <p>
              Because the integrated datasets include Anatolian/Open Context zooarchaeology and Oaxaca radiocarbon evidence, Astraea functions as a multi-site comparative instrument across Asia and North America: it can place local contexts beside absolute dating clusters, expose where chronologies align or diverge, and make uncertainty visible rather than hiding it behind a single date.
            </p>
            <div className="badge-row">
              <span>React</span>
              <span>FastAPI</span>
              <span>D3.js</span>
              <span>IntCal20</span>
              <span>MCMC Chronology</span>
              <span>PostGIS-ready</span>
            </div>
          </div>
          <aside className="hero-card">
            <span>Research Status</span>
            <strong>{number(researchData.reports.overview.totalOpenContextRows)} evidence rows</strong>
            <p>{researchData.reports.overview.positioning}</p>
            <button type="button" onClick={openGenerator}>Generate case file</button>
          </aside>
        </div>
      </header>

      <main>
        <AstraeaOrientation />

        <CommandCenter
          contexts={contexts}
          selectedContext={selected}
          editorState={editorState}
          edgeReview={edgeReview}
          anomalyReview={anomalyReview}
        />

        <GenerativeDiscoveryEngine
          contexts={contexts}
          selectedContext={selected}
          edgeReview={edgeReview}
          anomalyReview={anomalyReview}
          manualRelationships={manualRelationships}
          editorState={editorState}
          onSelect={setSelectedContext}
          onPin={pinEvidence}
        />

        <ResearchGapDiscovery
          contexts={contexts}
          editorState={editorState}
          edgeReview={edgeReview}
          onSelect={setSelectedContext}
          onPin={pinEvidence}
        />

        <section className="workspace-controls" id="evidence">
          <div>
            <span>Evidence View</span>
            <h2>Choose The Record Astraea Reads</h2>
          </div>
          <input value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} placeholder="Search contexts, units, strata, features..." />
          <select value={filters.site} onChange={event => setFilters({ ...filters, site: event.target.value })}>
            <option value="">All sites</option>
            {siteOptions.map(site => <option key={site}>{site}</option>)}
          </select>
          <select value={filters.project} onChange={event => setFilters({ ...filters, project: event.target.value })}>
            <option value="">All projects</option>
            {projectOptions.map(project => <option key={project}>{project}</option>)}
          </select>
          <select value={filters.source} onChange={event => setFilters({ ...filters, source: event.target.value })}>
            <option value="">All source layers</option>
            {sourceOptions.map(source => <option key={source}>{source}</option>)}
          </select>
        </section>

        <section className="grid two evidence-room">
          <EvidenceMap contexts={contexts} />
          <ContextExplorer
            contexts={contexts}
            selectedContext={selected}
            onSelect={setSelectedContext}
            editorState={editorState}
            onEditorChange={updateContext}
          />
        </section>

        <section id="matrix">
          <HarrisMatrixWorkbench
            contexts={contexts}
            reviewState={edgeReview}
            manualRelationships={manualRelationships}
            onReview={updateEdge}
            onBulkReview={bulkUpdateEdges}
            onAddManualRelationship={addManualRelationship}
            onDeleteManualRelationship={deleteManualRelationship}
            onExportReviewedEdges={exportReviewedEdges}
          />
        </section>

        <section className="grid two interpretation-room">
          <ChronologyPropagationWorkbench contexts={contexts} selectedContext={selected} />
          <ResearchNotebook pins={notebookPins} setPins={setNotebookPins} selectedContext={selected} />
        </section>

        <section className="grid two source-room" id="sources">
          <SourceInventory />
          <section className="panel">
            <div className="section-heading">
              <span>Interpretation Safety</span>
              <h2>What Astraea Is Actually Saying</h2>
              <p>Astraea generates research readings from evidence. It does not replace archaeological judgment, and it does not turn provisional graph edges into historical facts.</p>
            </div>
            <div className="mini-list">
              <p><strong>Source evidence:</strong> Open Context records, Oaxaca radiocarbon rows, Upland artifact tables, and Harris Matrix methodology.</p>
              <p><strong>Astraea layer:</strong> generated case files, normalized contexts, uncertainty readings, provisional graph relationships, and saved reasoning trails.</p>
              <p><strong>Safe citation practice:</strong> cite original repositories and record URIs for evidence; cite Astraea as your research software implementation.</p>
            </div>
          </section>
        </section>

        <section>
          <CitationCenter />
        </section>
      </main>
    </div>
  );
}
