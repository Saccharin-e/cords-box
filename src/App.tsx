/**
 * App.tsx — Main Cords Box Layout Container with Retractable Panels.
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

  const gridRows = isToolbarOpen ? '60px 1fr' : '36px 1fr';
  const gridCols = `${isSidebarOpen ? '280px' : '48px'} 1fr ${isInspectorOpen ? '320px' : '48px'}`;

  return (
    <div
      className="app-layout"
      id="app-root"
      style={{
        gridTemplateRows: gridRows,
        gridTemplateColumns: gridCols,
        transition: 'grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1), grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Toolbar />
      <ComponentLibrary />
      <DualCanvas />
      <ValueInspector />
    </div>
  );
}
