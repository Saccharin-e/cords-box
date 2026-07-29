import { useState } from 'react';

type ViewMode = 'physical' | 'schematic';

export function DualCanvas() {
  const [activeView, setActiveView] = useState<ViewMode>('physical');

  return (
    <section className="canvas-area" id="canvas-area">
      {/* Dot grid background */}
      <div className="canvas-area__bg" />

      {/* View toggle tabs */}
      <div className="canvas-area__tabs" id="view-tabs">
        <button
          className={`canvas-tab ${activeView === 'physical' ? 'canvas-tab--active' : ''}`}
          onClick={() => setActiveView('physical')}
          id="tab-physical"
        >
          Physical View
        </button>
        <button
          className={`canvas-tab ${activeView === 'schematic' ? 'canvas-tab--active' : ''}`}
          onClick={() => setActiveView('schematic')}
          id="tab-schematic"
        >
          Schematic View
        </button>
      </div>

      {/* Empty state */}
      <div className="canvas-empty">
        <div className="canvas-empty__icon">🎸</div>
        <p className="canvas-empty__text">
          Drag components from the library to start building your guitar wiring circuit.
        </p>
        <p className="canvas-empty__hint">
          {activeView === 'physical'
            ? 'Physical View — see your wiring as it would look inside a guitar body'
            : 'Schematic View — node-based electrical diagram of your circuit'}
        </p>
      </div>

      {/* Status bar */}
      <div className="status-bar" id="status-bar">
        <div className="status-bar__section">
          <span className="status-bar__indicator">
            <span className="status-bar__dot status-bar__dot--ok" />
            <span>Ready</span>
          </span>
        </div>
        <div className="status-bar__section">
          <span>0 nodes</span>
          <span>·</span>
          <span>0 edges</span>
          <span>·</span>
          <span>{activeView === 'physical' ? 'Physical' : 'Schematic'}</span>
        </div>
      </div>
    </section>
  );
}
