import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class AstraeaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-fallback">
          <section className="panel gold-frame">
            <div className="section-heading">
              <span>Astraea Recovery</span>
              <h2>The workspace hit a rendering error.</h2>
              <p>{this.state.error.message || 'A component failed to render. Refresh after the latest fix is applied.'}</p>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AstraeaErrorBoundary>
      <App />
    </AstraeaErrorBoundary>
  </React.StrictMode>
);
