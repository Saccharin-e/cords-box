/**
 * App.tsx — Main Cords Box Root Container.
 *
 * Toggles between:
 * 1. Home Dashboard (Templates, Tutorials, Docs, Saved Slots)
 * 2. Studio Workbench (Physical & Schematic Dual Canvas, Toolbar, Inspector)
 */

import { useEffect } from 'react';
import { Toolbar } from './ui/toolbar/Toolbar';
import { ComponentLibrary } from './ui/library/ComponentLibrary';
import { DualCanvas } from './ui/canvas/DualCanvas';
import { RightSidebar } from './ui/inspector/RightSidebar';
import { ExportModal } from './ui/export/ExportModal';
import { SettingsModal } from './ui/settings/SettingsModal';
import { HomePage } from './ui/home/HomePage';
import { FileDropzone } from './ui/common/FileDropzone';
import { TutorialGuideOverlay } from './ui/tutorials/TutorialGuideOverlay';
import { useCanvasStore } from '@store/canvasStore';
import { useProjectStore } from '@store/projectStore';

export default function App() {
  const currentView = useProjectStore((s) => s.currentView);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const inspectorWidth = useCanvasStore((s) => s.inspectorWidth);

  useEffect(() => {
    document.documentElement.style.setProperty('--inspector-width', `${inspectorWidth}px`);

    // Restore shared circuit from URL hash if present
    import('@graph/circuitSerializer').then(({ importCircuitFromUrlHash }) => {
      const restored = importCircuitFromUrlHash();
      if (restored) {
        navigateTo('editor');
      }
    });
  }, [inspectorWidth, navigateTo]);

  if (currentView === 'home') {
    return (
      <>
        <HomePage />
        <FileDropzone />
      </>
    );
  }

  const gridCols = `${isSidebarOpen ? '280px' : '0px'} 1fr ${isInspectorOpen ? 'var(--inspector-width, 320px)' : '0px'}`;

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
        transition: 'grid-template-columns 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Toolbar />
      <ComponentLibrary />
      <DualCanvas />
      <RightSidebar />
      <ExportModal />
      <SettingsModal />
      <TutorialGuideOverlay />
      <FileDropzone />
    </div>
  );
}
