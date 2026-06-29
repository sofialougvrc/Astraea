const API_BASE = import.meta.env.VITE_ASTRAEA_API_URL || (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:8000/api');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Astraea API ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function getApiHealth() {
  return request('/health');
}

export async function evaluateScenario(scenarioId) {
  return request('/model/evaluate', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}

export async function runBackendChronology(scenarioId) {
  return request('/chronology/run', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}

export async function predictBackendLinks(scenarioId) {
  return request('/stgnn/predict-links', {
    method: 'POST',
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
}
