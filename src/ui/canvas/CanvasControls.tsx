/**
 * CanvasControls — Floating CAD Bar for Themes, Grid Styles, Snap-to-Grid,
 * Rotate, Flip, Group, Copy/Paste, and Undo/Redo.
 * Supports retractable mini-pill mode.
 */

import { useCanvasStore, type CanvasTheme, type GridStyle } from '@store/canvasStore';
import { useKeybindingsStore } from '@store/keybindingsStore';
import { Button } from '../common/Button';

export function CanvasControls() {
  const openSettings = useKeybindingsStore((s) => s.openSettings);
  const themeMode = useCanvasStore((s) => s.themeMode);
  const gridStyle = useCanvasStore((s) => s.gridStyle);
  const gridSize = useCanvasStore((s) => s.gridSize);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const showComponentLabels = useCanvasStore((s) => s.showComponentLabels);
  const toggleShowComponentLabels = useCanvasStore((s) => s.toggleShowComponentLabels);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const isControlsOpen = useCanvasStore((s) => s.isControlsOpen);
  const toggleControls = useCanvasStore((s) => s.toggleControls);
  const setThemeMode = useCanvasStore((s) => s.setThemeMode);
  const setGridStyle = useCanvasStore((s) => s.setGridStyle);
  const setGridSize = useCanvasStore((s) => s.setGridSize);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);
  const rotateSelected = useCanvasStore((s) => s.rotateSelected);
  const flipSelectedH = useCanvasStore((s) => s.flipSelectedH);
  const flipSelectedV = useCanvasStore((s) => s.flipSelectedV);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const copySelected = useCanvasStore((s) => s.copySelected);
  const pasteSelected = useCanvasStore((s) => s.pasteSelected);
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const removeSelected = useCanvasStore((s) => s.removeSelected);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const hasSelection = selectedIds.length > 0;

  if (!isControlsOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(63, 63, 70, 0.65)',
        borderRadius: 10,
        boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
        color: '#e4e4e7',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── ROW 1: Display & Grid Configuration ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        {/* Theme Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconPalette color="#38bdf8" />
          <select
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as CanvasTheme)}
            style={selectStyle}
            title="Canvas Display Theme"
          >
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
            <option value="blueprint">Blueprint CAD</option>
            <option value="vintage">Vintage Paper</option>
          </select>
        </div>

        <div style={dividerStyle} />

        {/* Grid Style Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconGrid color="#a1a1aa" />
          <select
            value={gridStyle}
            onChange={(e) => setGridStyle(e.target.value as GridStyle)}
            style={selectStyle}
            title="Grid Background Style"
          >
            <option value="dots">Dot Matrix</option>
            <option value="lines">Line Grid</option>
            <option value="crosshatch">Crosshatch</option>
            <option value="isometric">Isometric 3D</option>
            <option value="none">No Grid</option>
          </select>
        </div>

        {/* Grid Size Selector */}
        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          style={selectStyle}
          title="Grid Step Size"
        >
          <option value={10}>10px</option>
          <option value={20}>20px</option>
          <option value={50}>50px</option>
        </select>

        <div style={dividerStyle} />

        {/* Snap & Labels Toggles */}
        <Button
          onClick={toggleSnapToGrid}
          style={{
            ...buttonStyle,
            backgroundColor: snapToGrid ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            color: snapToGrid ? '#38bdf8' : '#71717a',
            borderColor: snapToGrid ? '#0284c7' : 'transparent',
          }}
          title={`Snap to Grid (${snapToGrid ? 'ON' : 'OFF'}) - Shortcut: Shift+S`}
        >
          <IconMagnet color={snapToGrid ? '#38bdf8' : '#71717a'} />
          <span>Snap {snapToGrid ? 'ON' : 'OFF'}</span>
        </Button>

        <Button
          onClick={toggleShowComponentLabels}
          style={{
            ...buttonStyle,
            backgroundColor: showComponentLabels ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            color: showComponentLabels ? '#38bdf8' : '#71717a',
            borderColor: showComponentLabels ? '#0284c7' : 'transparent',
          }}
          title={`Component Text Overlay Labels (${showComponentLabels ? 'ON' : 'OFF'})`}
        >
          <IconTag color={showComponentLabels ? '#38bdf8' : '#71717a'} />
          <span>Labels {showComponentLabels ? 'ON' : 'OFF'}</span>
        </Button>
      </div>

      {/* ── ROW 2: CAD Editing & Transform Tools ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
        {/* Undo / Redo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="icon" aria-label="Undo" onClick={undo} style={buttonStyle} title="Undo (Ctrl+Z)">
            <IconUndo />
          </Button>
          <Button variant="icon" aria-label="Redo" onClick={redo} style={buttonStyle} title="Redo (Ctrl+Y)">
            <IconRedo />
          </Button>
        </div>

        <div style={dividerStyle} />

        {/* Transforms */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="icon"
            aria-label="Rotate CW 90°"
            onClick={() => rotateSelected(90)}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Rotate CW 90° (R)"
          >
            <IconRotateCw />
          </Button>
          <Button
            variant="icon"
            aria-label="Rotate CCW 90°"
            onClick={() => rotateSelected(-90)}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Rotate CCW 90° (Shift+R)"
          >
            <IconRotateCcw />
          </Button>
          <Button
            variant="icon"
            aria-label="Flip Horizontal"
            onClick={flipSelectedH}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Flip Horizontal (H)"
          >
            <IconFlipH />
          </Button>
          <Button
            variant="icon"
            aria-label="Flip Vertical"
            onClick={flipSelectedV}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Flip Vertical (V)"
          >
            <IconFlipV />
          </Button>
          <Button
            variant="icon"
            aria-label="Group Components"
            onClick={groupSelected}
            disabled={selectedIds.length < 2}
            style={{ ...buttonStyle, opacity: selectedIds.length >= 2 ? 1 : 0.4 }}
            title="Group Components (Ctrl+G)"
          >
            <IconGroup />
          </Button>
          <Button
            variant="icon"
            aria-label="Ungroup Components"
            onClick={ungroupSelected}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Ungroup Components (Ctrl+Shift+G)"
          >
            <IconUngroup />
          </Button>
        </div>

        <div style={dividerStyle} />

        {/* Editing */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="icon"
            aria-label="Copy"
            onClick={copySelected}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Copy (Ctrl+C)"
          >
            <IconCopy />
          </Button>
          <Button variant="icon" aria-label="Paste" onClick={pasteSelected} style={buttonStyle} title="Paste (Ctrl+V)">
            <IconPaste />
          </Button>
          <Button
            variant="icon"
            aria-label="Duplicate"
            onClick={duplicateSelected}
            disabled={!hasSelection}
            style={{ ...buttonStyle, opacity: hasSelection ? 1 : 0.4 }}
            title="Duplicate (Ctrl+D)"
          >
            <IconDuplicate />
          </Button>
          <Button
            variant="icon"
            aria-label="Delete"
            onClick={removeSelected}
            disabled={!hasSelection}
            style={{
              ...buttonStyle,
              opacity: hasSelection ? 1 : 0.4,
              color: hasSelection ? '#f87171' : '#71717a',
            }}
            title="Delete (Delete / Backspace)"
          >
            <IconTrash />
          </Button>
        </div>

        {/* Shortcuts & Keybindings Customizer */}
        <Button
          variant="icon"
          aria-label="Keyboard Shortcuts"
          onClick={openSettings}
          style={{ ...buttonStyle, color: '#38bdf8' }}
          title="Keyboard Shortcuts & Controls Reference (Press ?)"
          id="cad-bar-shortcuts"
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
        </Button>

        <div style={dividerStyle} />

        {/* Retract Floating Bar */}
        <Button
          variant="icon"
          aria-label="Collapse CAD Floating Bar"
          onClick={toggleControls}
          style={{ ...buttonStyle, color: '#a1a1aa' }}
          title="Collapse CAD Floating Bar"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

/* ── Inline Crisp SVG Icons ── */
function IconPalette({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="13.5" cy="6.5" r=".5" fill={color} />
      <circle cx="17.5" cy="10.5" r=".5" fill={color} />
      <circle cx="8.5" cy="7.5" r=".5" fill={color} />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.92 0 1.67-.75 1.67-1.67 0-.42-.17-.8-.44-1.08-.27-.28-.43-.65-.43-1.08 0-.92.75-1.67 1.67-1.67H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9z" />
    </svg>
  );
}

function IconGrid({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconMagnet({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 15v-3a6 6 0 1 1 12 0v3" />
      <path d="M6 15H3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3" />
      <path d="M18 15h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3" />
    </svg>
  );
}

function IconUndo() {
  return (
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
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function IconRedo() {
  return (
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
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
    </svg>
  );
}

function IconRotateCw() {
  return (
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
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 7" />
      <path d="M21 3v4h-4" />
    </svg>
  );
}

function IconRotateCcw() {
  return (
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
      <path d="M3 12a9 9 0 1 0 9-9 8.97 8.97 0 0 0-6.72 2.24L3 7" />
      <path d="M3 3v4h4" />
    </svg>
  );
}

function IconFlipH() {
  return (
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
      <path d="M12 3v18" strokeDasharray="3 3" />
      <path d="M8 7H3l5 10V7z" />
      <path d="M16 7h5l-5 10V7z" />
    </svg>
  );
}

function IconFlipV() {
  return (
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
      <path d="M3 12h18" strokeDasharray="3 3" />
      <path d="M7 8V3l10 5H7z" />
      <path d="M7 16v5l10-5H7z" />
    </svg>
  );
}

function IconGroup() {
  return (
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
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function IconUngroup() {
  return (
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
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function IconCopy() {
  return (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconPaste() {
  return (
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
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function IconDuplicate() {
  return (
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
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function IconTrash() {
  return (
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
  );
}

function IconTag({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <circle cx="7" cy="7" r="1.5" fill={color} />
    </svg>
  );
}

const selectStyle: React.CSSProperties = {
  backgroundColor: '#27272a',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: 4,
  padding: '2px 5px',
  fontSize: 11,
  cursor: 'pointer',
  outline: 'none',
};

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  backgroundColor: 'transparent',
  color: '#e4e4e7',
  border: '1px solid transparent',
  borderRadius: 4,
  padding: '3px 5px',
  fontSize: 11,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 14,
  backgroundColor: '#3f3f46',
  margin: '0 2px',
};
