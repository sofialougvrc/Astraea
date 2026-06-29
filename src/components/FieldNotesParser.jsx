import { useState } from 'react';
import { sampleFieldNote } from '../data/siteData.js';
import { parseFieldNotes } from '../lib/analysis.js';

export default function FieldNotesParser() {
  const [note, setNote] = useState(sampleFieldNote);
  const [result, setResult] = useState(() => parseFieldNotes(sampleFieldNote));

  function parse() {
    setResult(parseFieldNotes(note));
  }

  return (
    <section className="panel parser-panel">
      <div className="panel-heading">
        <span>LayoutLM-Inspired Parser Demo</span>
        <h2>Field Notes → Structured Evidence</h2>
      </div>
      <textarea value={note} onChange={event => setNote(event.target.value)} rows={7} />
      <button type="button" onClick={parse}>Parse Notes</button>
      <div className="extraction-grid">
        {Object.entries(result).map(([key, values]) => (
          <article key={key}>
            <span>{key}</span>
            {values.length ? values.map(value => <strong key={value}>{value}</strong>) : <em>No extraction</em>}
          </article>
        ))}
      </div>
    </section>
  );
}
