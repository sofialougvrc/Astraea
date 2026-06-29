import { formatRange } from '../lib/analysis.js';

export default function TrenchView({ units, selectedUnitId, highlightedUnits, onSelectUnit }) {
  return (
    <section className="panel trench-panel">
      <div className="panel-heading">
        <span>Excavation Trench</span>
        <h2>Layered Stratigraphy</h2>
      </div>
      <div className="trench-shell">
        {units.map((unit, index) => {
          const isSelected = selectedUnitId === unit.id;
          const isHighlighted = highlightedUnits.includes(unit.id);
          return (
            <button
              className={`trench-layer ${isSelected ? 'selected' : ''} ${unit.anomalous || isHighlighted ? 'anomalous' : ''}`}
              key={unit.id}
              style={{ '--layer-color': unit.color, '--layer-index': index }}
              type="button"
              onClick={() => onSelectUnit(unit.id)}
            >
              <strong>{unit.id}</strong>
              <span>{unit.label}</span>
              <small>{formatRange(unit.range)}</small>
            </button>
          );
        })}
      </div>
      <div className="unit-inspector">
        {units
          .filter(unit => unit.id === selectedUnitId)
          .map(unit => (
            <article key={unit.id}>
              <span className="eyebrow">{unit.phase} · {unit.confidence}% confidence</span>
              <h3>{unit.id}: {unit.label}</h3>
              <p>{unit.description}</p>
              <div className="artifact-list">
                {unit.artifacts.length ? unit.artifacts.map(artifact => (
                  <span key={artifact.id}>{artifact.id} · {artifact.name} · {formatRange(artifact.date)}</span>
                )) : <span>No cultural material recorded.</span>}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
