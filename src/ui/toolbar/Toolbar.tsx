/**
 * Toolbar — Top application bar.
 *
 * Contains brand, wiring mode toggle, export, and import actions.
 */

import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';

export function Toolbar() {
  const { wiringMode, startWiring: _s, cancelWiring, resetCanvas } = useCanvasStore();
  const { exportJSON, importJSON, reset: resetGraph } = useCircuitStore();

  function handleWiringToggle() {
    if (wiringMode) {
      cancelWiring();
    }
    // Wiring starts from lug clicks on the canvas
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'circuit.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      importJSON(text);
    };
    input.click();
  }

  function handleReset() {
    resetCanvas();
    resetGraph();
  }

  return (
    <header className="toolbar" id="toolbar">
      <div className="toolbar__brand">
        <div className="toolbar__logo">CB</div>
        <span className="toolbar__title">Cords Box</span>
        <span className="toolbar__subtitle">Guitar Wiring Sandbox</span>
      </div>

      <nav className="toolbar__actions">
        <button className="btn btn--sm" id="btn-reset" onClick={handleReset}>
          Reset
        </button>
        <button className="btn btn--sm" id="btn-import" onClick={handleImport}>
          Import
        </button>
        <button className="btn btn--sm" id="btn-export" onClick={handleExport}>
          Export
        </button>
        <button
          className={`btn btn--sm ${wiringMode ? 'btn--primary' : ''}`}
          id="btn-wire"
          onClick={handleWiringToggle}
          title="Click lugs on components to draw wires"
        >
          {wiringMode ? '⚡ Wiring…' : '⚡ Wire'}
        </button>
      </nav>
    </header>
  );
}
