/**
 * DualCanvas — host element for Physical + Schematic Konva stages.
 * Measures container size with throttled ResizeObserver for smooth performance.
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

  const instancesCount = useCanvasStore((s) => s.instances.length);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const selectedEdgeId = useCircuitStore((s) => s.selectedEdgeId);
  const graph = useCircuitStore((s) => s.graph);
  const solverResult = useCircuitStore((s) => s.solverResult);

  const removeInstance = useCanvasStore((s) => s.removeInstance);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const cancelWiring = useCanvasStore((s) => s.cancelWiring);
  const setPan = useCanvasStore((s) => s.setPan);
  const setScale = useCanvasStore((s) => s.setScale);

  const removeComponent = useCircuitStore((s) => s.removeComponent);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const selectEdge = useCircuitStore((s) => s.selectEdge);

  const nodeCount = graph.getNodes().length;
  const edgeCount = graph.getEdges().length;
  const diagnostics = lintCircuit(graph);
  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  const activePaths = solverResult?.activePaths.length ?? 0;

  // Throttled ResizeObserver for smooth 60FPS layout updates
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let rafId: number | null = null;
    const ro = new ResizeObserver(([entry]) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const { width, height } = entry.contentRect;
        setSize((prev) => {
          if (Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2) {
            return prev;
          }
          return { width, height };
        });
      });
    });

    ro.observe(el);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Global Keyboard Shortcuts (Delete, Backspace, Escape)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          removeInstance(selectedId);
          removeComponent(selectedId);
          selectInstance(null);
        } else if (selectedEdgeId) {
          e.preventDefault();
          removeEdge(selectedEdgeId);
          selectEdge(null);
        }
      } else if (e.key === 'Escape') {
        cancelWiring();
        selectInstance(null);
        selectEdge(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedEdgeId, removeInstance, removeComponent, selectInstance, removeEdge, selectEdge, cancelWiring]);

  const isEmpty = instancesCount === 0;

  function handleResetView() {
    setScale(1);
    setPan(0, 0);
  }

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
        <button
          className="canvas-tab"
          style={{ marginLeft: 'auto', fontSize: 11 }}
          onClick={handleResetView}
          title="Reset Zoom & Pan to 100%"
        >
          🎯 Fit View
        </button>
      </div>

      {/* Konva canvas */}
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
              ? 'Physical — click & drag canvas to pan · right-click or press Delete to remove'
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
