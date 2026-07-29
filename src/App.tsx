/**
 * App.tsx — Main Cords Box Layout Container.
 *
 * Header bar stays at top providing one-click toggles for Library, Inspector,
 * and CAD Tools. Retracted sidebars collapse to 0px so canvas claims 100% space.
 */

import { Toolbar } from './ui/toolbar/Toolbar';
import { ComponentLibrary } from './ui/library/ComponentLibrary';
import { DualCanvas } from './ui/canvas/DualCanvas';
import { ValueInspector } from './ui/inspector/ValueInspector';
import { ExportModal } from './ui/export/ExportModal';
import { useCanvasStore } from '@store/canvasStore';

export default function App() {
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);

  const gridCols = `${isSidebarOpen ? '280px' : '0px'} 1fr ${isInspectorOpen ? '320px' : '0px'}`;

  return (
    <div
      className="app-layout"
      id="app-root"
      style={{
        display: 'grid',
        gridTemplateRows: '52px 1fr',
        gridTemplateColumns: gridCols,
        gridTemplateAreas: '"toolbar toolbar toolbar" "sidebar canvas inspector"',
        gap: '12px',
        padding: '12px',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundColor: '#1b1b1e',
        transition: 'grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Toolbar />
      <ComponentLibrary />
      <DualCanvas />
      <ValueInspector />
      <ExportModal />
    </div>
  );
}
