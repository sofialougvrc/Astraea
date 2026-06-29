import { useEffect, useState } from 'react';
import { evaluateScenario, getApiHealth, predictBackendLinks, runBackendChronology } from '../lib/api.js';

export default function BackendConsole({ activeScenario }) {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking FastAPI service...');
  const [payload, setPayload] = useState(null);

  async function checkBackend(cancelled = () => false) {
    setStatus('checking');
    setMessage('Checking FastAPI service...');
    try {
      const data = await getApiHealth();
      if (cancelled()) return;
      setStatus('online');
      setMessage(`${data.service} online · ${data.stack.join(' · ')}`);
    } catch {
      if (cancelled()) return;
      setStatus('offline');
      setMessage('FastAPI backend not running. Frontend simulation remains active.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    checkBackend(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  async function runAction(action) {
    try {
      setStatus('online');
      setMessage('Running backend pipeline...');
      const data = await action(activeScenario);
      setPayload(data);
      setMessage('Backend response received.');
    } catch (error) {
      setStatus('offline');
      setPayload({ error: error.message });
      setMessage('Backend unavailable. Start FastAPI to activate live API calls.');
    }
  }

  return (
    <section className={`panel backend-console ${status}`}>
      <div className="panel-heading">
        <span>Full-Stack API Console</span>
        <h2>FastAPI · PostGIS · ST-GNN · PyMC Scaffold</h2>
      </div>
      <p>{message}</p>
      <div className="backend-actions">
        <button type="button" onClick={() => checkBackend()}>Recheck Backend</button>
        <button type="button" onClick={() => runAction(evaluateScenario)}>Evaluate Scenario</button>
        <button type="button" onClick={() => runAction(runBackendChronology)}>Run Chronology API</button>
        <button type="button" onClick={() => runAction(predictBackendLinks)}>Predict Missing Links</button>
      </div>
      {payload ? <pre>{JSON.stringify(payload, null, 2)}</pre> : null}
    </section>
  );
}
