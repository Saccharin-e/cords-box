import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { audioEngine, audioPipeline } from '@audio/index';

export function Toolbar() {
  const { wiringMode, cancelWiring, resetCanvas, isToolbarOpen, toggleToolbar } = useCanvasStore();
  const { exportJSON, importJSON, reset: resetGraph } = useCircuitStore();
  const [audioActive, setAudioActive] = useState(false);

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

  if (!isToolbarOpen) {
    return (
      <>
        {/* Retracted container claims 0px in grid layout */}
        <header
          className="toolbar"
          id="toolbar"
          style={{
            height: 0,
            minHeight: 0,
            padding: 0,
            margin: 0,
            overflow: 'hidden',
            border: 'none',
            opacity: 0,
            transition: 'all 0.25s ease',
          }}
        />

        {/* Floating Handle Tab on Top Edge */}
        <button
          onClick={toggleToolbar}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            backgroundColor: 'rgba(24, 24, 27, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(63, 63, 70, 0.6)',
            borderRadius: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            color: '#ff8c00',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Expand Main Toolbar & Audio Controls"
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: '#0a0a0c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            color: '#fff',
            fontWeight: 800,
          }}>CB</div>
          <span>CORDS BOX</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </>
    );
  }

  return (
    <header className="toolbar" id="toolbar" style={{ transition: 'all 0.25s ease' }}>
      <div className="toolbar__brand">
        <div className="toolbar__logo">CB</div>
        <span className="toolbar__title">Cords Box</span>
        <span className="toolbar__subtitle">Indie-Rock Telecaster Wiring Sandbox</span>
      </div>

      <nav className="toolbar__actions">
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

        {/* Retract Header Button */}
        <button
          onClick={toggleToolbar}
          style={toggleButtonStyle}
          title="Collapse Top Toolbar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      </nav>
    </header>
  );
}

const toggleButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  backgroundColor: '#27272a',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
