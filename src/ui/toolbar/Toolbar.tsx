import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { audioEngine, audioPipeline } from '@audio/index';
import { lintCircuit } from '@lint/linter';

export function Toolbar() {
  const {
    wiringMode, cancelWiring, resetCanvas,
    isSidebarOpen, toggleSidebar,
    isInspectorOpen, toggleInspector,
    isControlsOpen, toggleControls,
  } = useCanvasStore();

  const { exportJSON, importJSON, reset: resetGraph, graph } = useCircuitStore();
  const [audioActive, setAudioActive] = useState(false);

  const diagnostics = lintCircuit(graph);

  async function handleAudioToggle() {
    if (!audioActive) {
      await audioEngine.initialize();
      await audioEngine.resume();
      setAudioActive(true);
      useCircuitStore.getState().solve();
    } else {
      await audioEngine.suspend();
      setAudioActive(false);
    }
  }

  function handlePluck() {
    if (!audioActive) {
      void handleAudioToggle().then(() => {
        audioPipeline.triggerPluck();
      });
    } else {
      audioPipeline.triggerPluck();
    }
  }

  function handleWiringToggle() {
    if (wiringMode) {
      cancelWiring();
    }
  }

  function handleExport() {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'indie-tele-harness.json';
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
    <header className="toolbar" id="toolbar" style={{ gridArea: 'toolbar', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
      {/* Left Section: Brand Logo + Sidebar Toggle */}
      <div className="toolbar__brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="toolbar__logo">CB</div>
          <span className="toolbar__title" style={{ fontWeight: 800 }}>Cords Box</span>
        </div>

        {/* Toggle Component Library Sidebar */}
        <button
          className={`btn btn--sm ${isSidebarOpen ? 'btn--primary' : ''}`}
          onClick={toggleSidebar}
          title="Toggle Component Library Panel"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          <span>🧰</span>
          <span>Library</span>
        </button>
      </div>

      {/* Center Section: Core Workbench Actions */}
      <nav className="toolbar__actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className={`btn btn--sm ${audioActive ? 'btn--primary' : ''}`}
          id="btn-audio-power"
          onClick={handleAudioToggle}
          title="Toggle Web Audio Engine"
        >
          {audioActive ? '🔊 Audio ON' : '🔈 Audio OFF'}
        </button>

        <button
          className="btn btn--sm"
          id="btn-pluck"
          onClick={handlePluck}
          title="Pluck guitar string to test audio DSP pipeline"
        >
          🎵 Pluck String
        </button>

        <button
          className={`btn btn--sm ${wiringMode ? 'btn--primary' : ''}`}
          id="btn-wire"
          onClick={handleWiringToggle}
          title="Click lugs on components to draw wires"
        >
          {wiringMode ? '⚡ Wiring…' : '⚡ Wire'}
        </button>

        <div style={{ width: 1, height: 16, backgroundColor: '#3f3f46', margin: '0 4px' }} />

        <button
          className="btn btn--sm"
          id="btn-export-image"
          onClick={() => useCanvasStore.getState().toggleExportModal()}
          title="Export Canvas to High-Res PNG Image or PDF Document"
          style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', color: '#38bdf8', fontWeight: 700 }}
        >
          📷 Export Image/PDF
        </button>

        <button className="btn btn--sm" id="btn-import" onClick={handleImport} title="Import JSON Design">
          JSON Load
        </button>
        <button className="btn btn--sm" id="btn-export" onClick={handleExport} title="Save JSON Design">
          JSON Save
        </button>
        <button className="btn btn--sm" id="btn-reset" onClick={handleReset}>
          Reset
        </button>
      </nav>

      {/* Right Section: CAD Controls Toggle & Value Inspector Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Toggle Floating CAD Controls Bar */}
        <button
          className={`btn btn--sm ${isControlsOpen ? 'btn--primary' : ''}`}
          onClick={toggleControls}
          title="Toggle Floating CAD Tools (Themes, Grid, Snap, Rotate, Copy/Paste)"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          <span>⚙️</span>
          <span>CAD Tools</span>
        </button>

        {/* Toggle Value Inspector Panel */}
        <button
          className={`btn btn--sm ${isInspectorOpen ? 'btn--primary' : ''}`}
          onClick={toggleInspector}
          title="Toggle Component Inspector Panel"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          <span>️</span>
          <span>Inspector</span>
          {diagnostics.length > 0 && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 6px #f59e0b',
              }}
            />
          )}
        </button>
      </div>
    </header>
  );
}
