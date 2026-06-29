import { formatRange } from '../lib/analysis.js';

export default function ChronologyTimeline({ units, highlightedUnits }) {
  const min = -2400;
  const max = 2020;
  const span = max - min;

  function position(year) {
    return ((year - min) / span) * 100;
  }

  return (
    <section className="panel timeline-panel">
      <div className="panel-heading">
        <span>Bayesian Chronology Simulation</span>
        <h2>Posterior Date Bands</h2>
      </div>
      <div className="timeline-scale">
        <span>2400 BCE</span>
        <span>0</span>
        <span>2020 CE</span>
      </div>
      <div className="timeline-rows">
        {units.map(unit => {
          const left = position(unit.posterior[0]);
          const width = Math.max(3, position(unit.posterior[1]) - left);
          return (
            <article className={`timeline-row ${highlightedUnits.includes(unit.id) ? 'highlighted' : ''}`} key={unit.id}>
              <div>
                <strong>{unit.id}</strong>
                <span>{unit.label}</span>
              </div>
              <div className="timeline-track">
                <i style={{ left: `${left}%`, width: `${width}%`, background: unit.color }} />
              </div>
              <small>{formatRange(unit.posterior)} · {unit.confidence}%</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
