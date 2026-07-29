/**
 * App.tsx — Main Cords Box Layout Container with Retractable Panels.
 *
 * When panels are collapsed, their width/height becomes 0px and the canvas
 * claims 100% of the screen space.
 */

import { Toolbar } from './ui/toolbar/Toolbar';
import { ComponentLibrary } from './ui/library/ComponentLibrary';
import { DualCanvas } from './ui/canvas/DualCanvas';
import { ValueInspector } from './ui/inspector/ValueInspector';
import { useCanvasStore } from '@store/canvasStore';

export default function App() {
  const isToolbarOpen = useCanvasStore((s) => s.isToolbarOpen);
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);

  const gridRows = isToolbarOpen ? '60px 1fr' : '0px 1fr';
  const gridCols = `${isSidebarOpen ? '280px' : '0px'} 1fr ${isInspectorOpen ? '320px' : '0px'}`;
  const hasOpenPanel = isToolbarOpen || isSidebarOpen || isInspectorOpen;

  return (
    <div
      className="app-layout"
      id="app-root"
      style={{
        display: 'grid',
        gridTemplateRows: gridRows,
        gridTemplateColumns: gridCols,
        gridTemplateAreas: '"toolbar toolbar toolbar" "sidebar canvas inspector"',
        gap: hasOpenPanel ? '12px' : '0px',
        padding: hasOpenPanel ? '12px' : '0px',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: '#1b1b1e',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Toolbar />
      <ComponentLibrary />
      <DualCanvas />
      <ValueInspector />
    </div>
  );
}
