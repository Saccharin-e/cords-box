import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { useKeybindingsStore } from '@store/keybindingsStore';

export function Toolbar() {
  const activeView = useCanvasStore((s) => s.activeView);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const toggleWiringMode = useCanvasStore((s) => s.toggleWiringMode);
  const resetCanvas = useCanvasStore((s) => s.resetCanvas);
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const toggleSidebar = useCanvasStore((s) => s.toggleSidebar);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const toggleInspector = useCanvasStore((s) => s.toggleInspector);
  const isControlsOpen = useCanvasStore((s) => s.isControlsOpen);
  const toggleControls = useCanvasStore((s) => s.toggleControls);
  const isTestPanelOpen = useCanvasStore((s) => s.isTestPanelOpen);
  const toggleTestPanel = useCanvasStore((s) => s.toggleTestPanel);
  const isAmpPanelOpen = useCanvasStore((s) => s.isAmpPanelOpen);
  const toggleAmpPanel = useCanvasStore((s) => s.toggleAmpPanel);
  const isFretboardOpen = useCanvasStore((s) => s.isFretboardOpen);
  const toggleFretboard = useCanvasStore((s) => s.toggleFretboard);
  const isTabPanelOpen = useCanvasStore((s) => s.isTabPanelOpen);
  const toggleTabPanel = useCanvasStore((s) => s.toggleTabPanel);
  const isSlotModalOpen = useCanvasStore((s) => s.isSlotModalOpen);
  const toggleSlotModal = useCanvasStore((s) => s.toggleSlotModal);
  const toggleExportModal = useCanvasStore((s) => s.toggleExportModal);

  const openSettings = useKeybindingsStore((s) => s.openSettings);
  const exportJSON = useCircuitStore((s) => s.exportJSON);
  const importJSON = useCircuitStore((s) => s.importJSON);
  const resetGraph = useCircuitStore((s) => s.reset);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dropdown Open States
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          className={`btn btn--sm ${isSidebarOpen && activeView !== 'sound_systems' ? 'btn--primary' : ''}`}
          onClick={toggleSidebar}
          title={
            activeView === 'sound_systems'
              ? 'Library is hidden in Sound System mode (click to restore Physical view)'
              : 'Toggle Component Library Panel'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            opacity: activeView === 'sound_systems' ? 0.35 : 1,
            color: activeView === 'sound_systems' ? '#71717a' : undefined,
            borderColor: activeView === 'sound_systems' ? '#27272a' : undefined,
            backgroundColor: activeView === 'sound_systems' ? 'transparent' : undefined,
            pointerEvents: 'auto',
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
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span>Library</span>
        </button>
      </div>

      {/* Center Section: Compact Dropdown Navigation */}
      <nav className="toolbar__actions" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* 1. File Menu Dropdown */}
        <div ref={fileMenuRef} style={{ position: 'relative' }}>
          <button
            className={`btn btn--sm ${isFileMenuOpen ? 'btn--primary' : ''}`}
            onClick={() => {
              setIsFileMenuOpen(!isFileMenuOpen);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, padding: '4px 8px' }}
          >
            <svg
              width="13"
              height="13"
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

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  toggleSlotModal();
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
                </svg>
                <span>Layout Slots & Templates...</span>
              </button>

              <button
                style={dropdownItemStyle}
                onClick={() => {
                  setIsFileMenuOpen(false);
                  openSettings();
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
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Shortcuts & Keybindings (?)</span>
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

        {/* 2. Wire Tool Toggle Button */}
        <button
          className={`btn btn--sm ${wiringMode ? 'btn--primary' : ''}`}
          id="btn-wire"
          onClick={handleWiringToggle}
          title="Click lugs on components to draw wires"
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '4px 8px' }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>{wiringMode ? 'Wiring…' : 'Wire'}</span>
        </button>

        <div style={{ width: 1, height: 16, backgroundColor: '#3f3f46', margin: '0 2px' }} />

        {/* Direct Guitar Sound Test Bench Toggle */}
        <button
          className={`btn btn--sm ${isTestPanelOpen ? 'btn--primary' : ''}`}
          onClick={toggleTestPanel}
          title="Guitar Pickups & Tone Sound Test Bench"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 700,
            backgroundColor: isTestPanelOpen ? '#d97706' : '#27272a',
            color: '#ffffff',
            border: isTestPanelOpen ? '1px solid #f59e0b' : '1px solid #3f3f46',
            padding: '4px 8px',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span>Test Bench</span>
        </button>

        {/* Amp & Pedalboard Panel Toggle */}
        <button
          className={`btn btn--sm ${isAmpPanelOpen ? 'btn--primary' : ''}`}
          onClick={toggleAmpPanel}
          title="Customizable Amp Simulator & Stompbox Pedalboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 700,
            backgroundColor: isAmpPanelOpen ? '#0284c7' : '#27272a',
            color: '#f4f4f5',
            border: '1px solid #3f3f46',
            padding: '4px 8px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
          </svg>
          <span>Amp</span>
        </button>

        {/* Playable Guitar Fretboard Panel Toggle */}
        <button
          className={`btn btn--sm ${isFretboardOpen ? 'btn--primary' : ''}`}
          onClick={toggleFretboard}
          title="Interactive Playable Guitar Fretboard Simulation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 700,
            backgroundColor: isFretboardOpen ? '#b45309' : '#27272a',
            color: '#fef3c7',
            border: isFretboardOpen ? '1px solid #f59e0b' : '1px solid #3f3f46',
            padding: '4px 8px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Fretboard</span>
        </button>

        {/* Guitar Tab Player & Editor Panel Toggle */}
        <button
          className={`btn btn--sm ${isTabPanelOpen ? 'btn--primary' : ''}`}
          onClick={toggleTabPanel}
          title="ASCII Guitar Tab Editor & Playback Scheduler"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 700,
            backgroundColor: isTabPanelOpen ? '#1d4ed8' : '#27272a',
            color: '#93c5fd',
            border: isTabPanelOpen ? '1px solid #3b82f6' : '1px solid #3f3f46',
            padding: '4px 8px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span>Tab Player</span>
        </button>

        {/* Saveable Layout Slots Modal Toggle */}
        <button
          className={`btn btn--sm ${isSlotModalOpen ? 'btn--primary' : ''}`}
          onClick={toggleSlotModal}
          title="Save and Load Canvas Layout Slots & Circuit Templates"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 700,
            backgroundColor: isSlotModalOpen ? '#0369a1' : '#27272a',
            color: '#e0f2fe',
            border: isSlotModalOpen ? '1px solid #38bdf8' : '1px solid #3f3f46',
            padding: '4px 8px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          </svg>
          <span>Slots</span>
        </button>
      </nav>

      {/* Right Section: Retractable Panel Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Toggle Floating CAD Controls Bar */}
        <button
          className={`btn btn--sm ${isControlsOpen && activeView !== 'sound_systems' ? 'btn--primary' : ''}`}
          onClick={toggleControls}
          title={
            activeView === 'sound_systems'
              ? 'CAD tools are hidden in Sound System mode (click to restore Physical view)'
              : 'Toggle Floating CAD Tools (Themes, Grid, Snap, Rotate, Copy/Paste)'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '4px 8px',
            opacity: activeView === 'sound_systems' ? 0.35 : 1,
            color: activeView === 'sound_systems' ? '#71717a' : undefined,
            borderColor: activeView === 'sound_systems' ? '#27272a' : undefined,
            backgroundColor: activeView === 'sound_systems' ? 'transparent' : undefined,
          }}
        >
          <svg
            width="13"
            height="13"
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
          <span>CAD</span>
        </button>

        {/* Toggle Inspector Panel */}
        <button
          className={`btn btn--sm ${isInspectorOpen && activeView !== 'sound_systems' ? 'btn--primary' : ''}`}
          onClick={toggleInspector}
          title={
            activeView === 'sound_systems'
              ? 'Inspector is hidden in Sound System mode (click to restore Physical view)'
              : 'Toggle Value Inspector Panel'
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            padding: '4px 8px',
            opacity: activeView === 'sound_systems' ? 0.35 : 1,
            color: activeView === 'sound_systems' ? '#71717a' : undefined,
            borderColor: activeView === 'sound_systems' ? '#27272a' : undefined,
            backgroundColor: activeView === 'sound_systems' ? 'transparent' : undefined,
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span>Inspector</span>
        </button>

        {/* Shortcuts & Keybindings Info Button (Icon-Only) */}
        <button
          className="btn btn--sm"
          onClick={openSettings}
          title="Keyboard Shortcuts & Controls Reference (Press ?)"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            backgroundColor: '#27272a',
            color: '#38bdf8',
            border: '1px solid #0284c7',
            borderRadius: 4,
            cursor: 'pointer',
          }}
          id="btn-shortcuts"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          className="btn btn--sm"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            backgroundColor: '#27272a',
            color: '#a1a1aa',
            border: '1px solid #3f3f46',
            borderRadius: 4,
            cursor: 'pointer',
          }}
          id="btn-fullscreen"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isFullscreen ? (
              <>
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </>
            ) : (
              <>
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </>
            )}
          </svg>
        </button>
      </div>
    </header>
  );
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  zIndex: 1000,
  width: 210,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '6px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 500,
  color: '#e4e4e7',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'background-color 0.15s ease',
};

const dropdownDividerStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: '#27272a',
  margin: '4px 0',
};
