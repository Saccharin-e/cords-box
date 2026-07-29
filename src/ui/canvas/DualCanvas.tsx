/**
 * DualCanvas — host element for Physical + Schematic Konva stages.
 *
 * Measures its own DOM size and passes width/height to the active view,
 * keeping the canvas crisp at any panel size. Manages the tab switcher,
 * empty state, and status bar.
 */

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { lintCircuit } from '@lint/linter';
import { PhysicalView } from './PhysicalView';
import { SchematicView } from './SchematicView';

type ViewMode = 'physical' | 'schematic';

export function DualCanvas() {
  const [activeView, setActiveView] = useState<ViewMode>('physical');
  const containerRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const instances = useCanvasStore((s) => s.instances);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const graphEdges = useCircuitStore((s) => s.graph.getEdges());
  const graph = useCircuitStore((s) => s.graph);
  const solverResult = useCircuitStore((s) => s.solverResult);

  const diagnostics = lintCircuit(graph);
  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const nodeCount = useCircuitStore((s) => s.graph.getNodes().length);
  const edgeCount = graphEdges.length;

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isEmpty = instances.length === 0;
  const activePaths = solverResult?.activePaths.length ?? 0;

  return (
    <section className="canvas-area" ref={containerRef} id="canvas-area">
      {/* Dot grid background */}
      <div className="canvas-area__bg" />

      {/* View toggle tabs */}
      <div className="canvas-area__tabs" id="view-tabs">
        <button
          className={`canvas-tab ${activeView === 'physical' ? 'canvas-tab--active' : ''}`}
          onClick={() => setActiveView('physical')}
          id="tab-physical"
        >
          Physical
        </button>
        <button
          className={`canvas-tab ${activeView === 'schematic' ? 'canvas-tab--active' : ''}`}
          onClick={() => setActiveView('schematic')}
          id="tab-schematic"
        >
          Schematic
        </button>
        {wiringMode && (
          <span className="canvas-tab" style={{ color: '#ff8c00', cursor: 'default' }}>
            ⚡ WIRING
          </span>
        )}
      </div>

      {/* Konva canvas — shown once we have size */}
      {size.width > 0 && (
        <>
          {activeView === 'physical' ? (
            <PhysicalView width={size.width} height={size.height} />
          ) : (
            <SchematicView width={size.width} height={size.height} />
          )}
        </>
      )}

      {/* Empty state overlay */}
      {isEmpty && (
        <div className="canvas-empty" style={{ pointerEvents: 'none' }}>
          <div className="canvas-empty__icon">🎸</div>
          <p className="canvas-empty__text">
            Drag components from the library to start building your wiring circuit
          </p>
          <p className="canvas-empty__hint">
            {activeView === 'physical'
              ? 'Physical — wiring as it looks inside a guitar'
              : 'Schematic — node-based electrical diagram'}
          </p>
        </div>
      )}

      {/* Status bar */}
      <div className="status-bar" id="status-bar">
        <div className="status-bar__section">
          <span className="status-bar__indicator">
            <span className={`status-bar__dot ${hasErrors ? 'status-bar__dot--error' : 'status-bar__dot--ok'}`} />
            <span>{hasErrors ? 'ERR' : 'OK'}</span>
          </span>
          <span>{activePaths} path{activePaths !== 1 ? 's' : ''}</span>
        </div>
        <div className="status-bar__section">
          <span>{nodeCount} node{nodeCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{edgeCount} wire{edgeCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{activeView === 'physical' ? 'PHY' : 'SCH'}</span>
        </div>
      </div>
    </section>
  );
}
