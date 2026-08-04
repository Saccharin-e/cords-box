/**
 * RightSidebar.tsx — Dedicated Right Sidebar Column for Value Inspector & Wiring Diagnostics
 *
 * Houses separate VS Code-style accordion panels:
 * 1. Value Inspector (top)
 * 2. Wiring Diagnostics (bottom)
 *
 * Both panels disappear cleanly when the toolbar Inspector toggle is retracted.
 */

import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { ValueInspector } from './ValueInspector';
import { WiringDiagnosticsPanel } from './WiringDiagnosticsPanel';

export function RightSidebar() {
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const setInspectorWidth = useCanvasStore((s) => s.setInspectorWidth);
  const [isResizing, setIsResizing] = useState(false);

  if (!isInspectorOpen) return null;

  function handleResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    document.body.classList.add('is-resizing');

    let currentWidth = useCanvasStore.getState().inspectorWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const calculatedWidth = Math.max(220, Math.min(650, window.innerWidth - moveEvent.clientX - 12));
      currentWidth = calculatedWidth;
      document.documentElement.style.setProperty('--inspector-width', `${calculatedWidth}px`);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.body.classList.remove('is-resizing');
      setInspectorWidth(currentWidth);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
  }

  return (
    <aside
      className="inspector-column"
      style={{
        gridArea: 'inspector',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        gap: 6,
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      {/* Draggable Side Panel Divider Handle */}
      <div
        className={`inspector-resizer ${isResizing ? 'inspector-resizer--active' : ''}`}
        onMouseDown={handleResizeStart}
        title="Drag to adjust sidebar width"
      />

      {/* Top VS Code Accordion Panel: Value Inspector */}
      <ValueInspector />

      {/* Bottom VS Code Accordion Panel: Wiring Diagnostics */}
      <WiringDiagnosticsPanel />
    </aside>
  );
}
