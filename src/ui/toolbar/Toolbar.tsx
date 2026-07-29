import { useState, useRef, useEffect } from 'react';
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
    toggleExportModal,
  } = useCanvasStore();

  const { exportJSON, importJSON, reset: resetGraph, graph } = useCircuitStore();
  const [audioActive, setAudioActive] = useState(false);

  // Dropdown Open States
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const fileMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);

  const diagnostics = lintCircuit(graph);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setIsFileMenuOpen(false);
      }
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setIsAudioMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (confirm('Reset entire canvas and remove all placed components?')) {
      resetCanvas();
      resetGraph();
    }
  }

  return (
    <header
      className="toolbar"
      id="toolbar"
      style={{
        gridArea: 'toolbar',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: '#18181b',
        borderBottom: '1px solid #27272a',
      }}
    >
      {/* Left Section: Brand Logo + Sidebar Toggle */}
      <div className="toolbar__brand" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="toolbar__logo">CB</div>
          <span className="toolbar__title" style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.04em' }}>
            Cords Box
          </span>
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

      {/* Center Section: Compact Dropdown Navigation */}
      <nav className="toolbar__actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 1. File Menu Dropdown */}
        <div ref={fileMenuRef} style={{ position: 'relative' }}>
          <button
            className={`btn btn--sm ${isFileMenuOpen ? 'btn--primary' : ''}`}
            onClick={() => {
              setIsFileMenuOpen(!isFileMenuOpen);
              setIsAudioMenuOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <span>📁</span>
            <span>File</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
          </button>

          {isFileMenuOpen && (
            <div style={dropdownStyle}>
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  toggleExportModal();
                }}
              >
                <span style={{ fontSize: 14 }}>📷</span>
                <span>Export Image / PDF...</span>
              </button>

              <div style={dropdownDividerStyle} />

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  handleExport();
                }}
              >
                <span style={{ fontSize: 14 }}>💾</span>
                <span>Save JSON Harness</span>
              </button>

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  handleImport();
                }}
              >
                <span style={{ fontSize: 14 }}>📂</span>
                <span>Open JSON Harness...</span>
              </button>

              <div style={dropdownDividerStyle} />

              <button
                style={{ ...dropdownItemStyle, color: '#f87171' }}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  handleReset();
                }}
              >
                <span style={{ fontSize: 14 }}>🗑️</span>
                <span>Clear Canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Audio Engine Dropdown */}
        <div ref={audioMenuRef} style={{ position: 'relative' }}>
          <button
            className={`btn btn--sm ${audioActive ? 'btn--primary' : ''}`}
            onClick={() => {
              setIsAudioMenuOpen(!isAudioMenuOpen);
              setIsFileMenuOpen(false);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>{audioActive ? '🔊' : '🔈'}</span>
            <span>Audio DSP</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
          </button>

          {isAudioMenuOpen && (
            <div style={dropdownStyle}>
              <button
                style={dropdownItemStyle}
                onClick={() => {
                  handleAudioToggle();
                }}
              >
                <span style={{ fontSize: 14 }}>{audioActive ? '⏹️' : '▶️'}</span>
                <span>{audioActive ? 'Power OFF Audio DSP' : 'Power ON Audio DSP'}</span>
              </button>

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  handlePluck();
                }}
              >
                <span style={{ fontSize: 14 }}>🎵</span>
                <span>Pluck Guitar String</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 16, backgroundColor: '#3f3f46', margin: '0 4px' }} />

        {/* Wire Tool Toggle Button */}
        <button
          className={`btn btn--sm ${wiringMode ? 'btn--primary' : ''}`}
          id="btn-wire"
          onClick={handleWiringToggle}
          title="Click lugs on components to draw wires"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <span>⚡</span>
          <span>{wiringMode ? 'Wiring Active…' : 'Wire Mode'}</span>
        </button>
      </nav>

      {/* Right Section: Retractable Panel Toggles */}
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
          <span>📋</span>
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

// ─── Dropdown Menu Styles ───────────────────────────────────────────────────

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  minWidth: 190,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '6px 0',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  backgroundColor: 'transparent',
  border: 'none',
  color: '#e4e4e7',
  fontSize: 12,
  fontWeight: 500,
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
  width: '100%',
};

const dropdownDividerStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: '#27272a',
  margin: '4px 0',
};
