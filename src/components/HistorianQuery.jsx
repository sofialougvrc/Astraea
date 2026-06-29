const queries = [
  { id: 'burning', label: 'Show all layers associated with burning events.' },
  { id: 'contradictions', label: 'Find all layers with date contradictions.' },
  { id: 'intrusive', label: 'Identify possible intrusive artifacts.' },
  { id: 'roman', label: 'Which layers likely belong to the Roman phase?' },
  { id: 'uncertain', label: 'Where does the chronology become uncertain?' },
];

export default function HistorianQuery({ selectedQuery, queryResult, onSelectQuery }) {
  return (
    <section className="panel query-panel">
      <div className="panel-heading">
        <span>Historian Macro-Query</span>
        <h2>Ask the Site Model</h2>
      </div>
      <div className="query-buttons">
        {queries.map(query => (
          <button className={selectedQuery === query.id ? 'active' : ''} type="button" key={query.id} onClick={() => onSelectQuery(query.id)}>
            {query.label}
          </button>
        ))}
      </div>
      <article className="query-answer">
        <span>{queryResult.title}</span>
        <p>{queryResult.answer}</p>
        <strong>Highlighted units: {queryResult.units.length ? queryResult.units.join(', ') : 'none'}</strong>
      </article>
    </section>
  );
}
