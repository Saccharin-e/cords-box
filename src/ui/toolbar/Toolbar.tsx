import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { useKeybindingsStore } from '@store/keybindingsStore';
import { audioEngine, audioPipeline } from '@audio/index';
import { lintCircuit } from '@lint/linter';

export function Toolbar() {
  const {
    wiringMode,
    toggleWiringMode,
    resetCanvas,
    isSidebarOpen,
    toggleSidebar,
    isInspectorOpen,
    toggleInspector,
    isControlsOpen,
    toggleControls,
    toggleExportModal,
  } = useCanvasStore();

  const { exportJSON, importJSON, reset: resetGraph, graph } = useCircuitStore();
  const [audioActive, setAudioActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dropdown Open States
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);

  const fileMenuRef = useRef<HTMLDivElement>(null);
  const audioMenuRef = useRef<HTMLDivElement>(null);

  const diagnostics = lintCircuit(graph);

  // Listen to fullscreen changes
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

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
    toggleWiringMode();
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
            <rect
              x="1.5"
              y="1.5"
              width="29"
              height="29"
              rx="5"
              fill="#121215"
              stroke="#3f3f46"
              strokeWidth="1.5"
            />
            <path
              d="M 6 10 C 14 4, 18 20, 26 14 C 20 28, 8 18, 16 10 C 24 2, 28 22, 22 26"
              stroke="#d97706"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 10 26 C 4 18, 22 8, 14 24 C 28 12, 10 6, 26 22"
              stroke="#0284c7"
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.9"
            />
            <circle cx="6" cy="10" r="1.5" fill="#d97706" />
            <circle cx="22" cy="26" r="1.5" fill="#d97706" />
            <circle cx="10" cy="26" r="1.5" fill="#0284c7" />
            <circle cx="26" cy="22" r="1.5" fill="#0284c7" />
          </svg>
          <span
            className="toolbar__title"
            style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.04em' }}
          >
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>Save JSON Harness</span>
              </button>

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  handleImport();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
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
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
                <span>{audioActive ? 'Power OFF Audio DSP' : 'Power ON Audio DSP'}</span>
              </button>

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  handlePluck();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          <span>CAD Tools</span>
        </button>

        {/* Toggle Value Inspector Panel */}
        <button
          className={`btn btn--sm ${isInspectorOpen ? 'btn--primary' : ''}`}
          onClick={toggleInspector}
          title="Toggle Component Inspector Panel"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="9" y1="9" x2="15" y2="9" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
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

        {/* Shortcuts & Settings Modal Button */}
        <button
          className="btn btn--sm"
          onClick={() => useKeybindingsStore.getState().openSettings()}
          title="CAD Shortcuts & Controls Reference (Key: ?)"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#38bdf8' }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Shortcuts</span>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          className={`btn btn--sm ${isFullscreen ? 'btn--primary' : ''}`}
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen Mode (Shift+F)' : 'Enter Fullscreen Mode (Shift+F)'}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
        >
          {isFullscreen ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
          <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
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
