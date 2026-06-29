export default function AnomalyReport({ activeScenario, scoreReport, scenarios, onScenarioChange }) {
  return (
    <section className="panel report-panel">
      <div className="panel-heading">
        <span>Consistency Engine</span>
        <h2>Stratigraphic Consistency Score</h2>
      </div>
      <div className={`score-orb score-${scoreReport.status.toLowerCase()}`} style={{ '--score': scoreReport.score }}>
        <strong>{scoreReport.score}</strong>
        <span>{scoreReport.status}</span>
      </div>
      <div className="control-block">
        <label htmlFor="scenario-select">Inject anomaly</label>
        <select id="scenario-select" value={activeScenario} onChange={event => onScenarioChange(event.target.value)}>
          <option value="baseline">Baseline site model</option>
          {scenarios.map(scenario => (
            <option value={scenario.id} key={scenario.id}>{scenario.label}</option>
          ))}
        </select>
      </div>
      <div className="report-list">
        <h3>What lowered the score</h3>
        {scoreReport.loweredBy.map(item => <p key={item}>{item}</p>)}
      </div>
      <div className="report-list">
        <h3>Anomaly explanations</h3>
        {scoreReport.contradictions.length ? scoreReport.contradictions.slice(0, 4).map(item => (
          <article className="mini-report" key={`${item.type}-${item.message}`}>
            <span>{item.type}</span>
            <p>{item.message}</p>
          </article>
        )) : <p>No major contradiction detected in the baseline model.</p>}
      </div>
    </section>
  );
}
