/**
 * DualCanvas — host element for Physical + Schematic Konva stages.
 * Measures container size with throttled ResizeObserver for smooth performance.
 */

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { PhysicalView } from './PhysicalView';
import { SchematicView } from './SchematicView';
import { GuitarSoundTestPanel } from '../toolbar/GuitarSoundTestPanel';
import { AmpPedalboardPanel } from '../toolbar/AmpPedalboardPanel';
import { PlayableFretboardPanel } from '../toolbar/PlayableFretboardPanel';
import { LayoutSlotsModal } from '../settings/LayoutSlotsModal';

type ViewMode = 'physical' | 'schematic';

export function DualCanvas() {
  const [activeView, setActiveView] = useState<ViewMode>('physical');
  const containerRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const instancesCount = useCanvasStore((s) => s.instances.length);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const isTestPanelOpen = useCanvasStore((s) => s.isTestPanelOpen);
  const isAmpPanelOpen = useCanvasStore((s) => s.isAmpPanelOpen);
  const isFretboardOpen = useCanvasStore((s) => s.isFretboardOpen);
  const isSlotModalOpen = useCanvasStore((s) => s.isSlotModalOpen);
  const activeFloatingPanel = useCanvasStore((s) => s.activeFloatingPanel);
  const setActiveFloatingPanel = useCanvasStore((s) => s.setActiveFloatingPanel);
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
  const diagnostics = useCircuitStore((s) => s.diagnostics);
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
  }, [
    selectedId,
    selectedEdgeId,
    removeInstance,
    removeComponent,
    selectInstance,
    removeEdge,
    selectEdge,
    cancelWiring,
  ]);

  const isEmpty = instancesCount === 0;

  function handleResetView() {
    setScale(1);
    setPan(size.width / 2, size.height / 2);
  }

  return (
    <section className="canvas-area" ref={containerRef} id="canvas-area" style={{ position: 'relative' }}>
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
          <span
            className="canvas-tab"
            style={{
              color: 'var(--color-accent-amber)',
              cursor: 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            WIRING
          </span>
        )}
        <div style={{ width: 1, height: 12, backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 2px' }} />
        <button
          className="canvas-tab"
          style={{
            fontSize: '0.62rem',
            padding: '3px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: '#a1a1aa',
          }}
          onClick={handleResetView}
          title="Reset Zoom & Pan to 100%"
          id="btn-fit-view"
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>Fit</span>
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

      {/* Retractable Guitar Audio Test Panel */}
      {isTestPanelOpen && (
        <div
          onPointerDown={() => setActiveFloatingPanel('test')}
          style={{
            position: 'absolute',
            top: 70,
            left: 20,
            zIndex: activeFloatingPanel === 'test' ? 100 : 90,
          }}
        >
          <GuitarSoundTestPanel />
        </div>
      )}

      {/* Retractable Amp Simulator & Pedalboard Panel */}
      {isAmpPanelOpen && (
        <div
          onPointerDown={() => setActiveFloatingPanel('amp')}
          style={{
            position: 'absolute',
            top: 70,
            left: 20,
            zIndex: activeFloatingPanel === 'amp' ? 100 : 95,
          }}
        >
          <AmpPedalboardPanel />
        </div>
      )}

      {/* Retractable Interactive Playable Fretboard Panel */}
      {isFretboardOpen && (
        <div
          onPointerDown={() => setActiveFloatingPanel('fretboard')}
          style={{
            position: 'absolute',
            top: 70,
            left: '50%',
            zIndex: activeFloatingPanel === 'fretboard' ? 100 : 96,
          }}
        >
          <PlayableFretboardPanel />
        </div>
      )}

      {/* Saveable Layout Slots & Circuit Template Modal */}
      {isSlotModalOpen && <LayoutSlotsModal />}

      {/* Empty state overlay */}
      {isEmpty && (
        <div className="canvas-empty" style={{ pointerEvents: 'auto' }}>
          <div className="canvas-empty__icon" style={{ opacity: 0.4 }}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <p className="canvas-empty__text">drag and drop components to get started</p>
        </div>
      )}

      {/* Status bar */}
      <div className="status-bar" id="status-bar">
        <div className="status-bar__section">
          <span className="status-bar__indicator">
            <span
              className={`status-bar__dot ${hasErrors ? 'status-bar__dot--error' : 'status-bar__dot--ok'}`}
            />
            <span>{hasErrors ? 'ERR' : 'OK'}</span>
          </span>
          <span>
            {activePaths} path{activePaths !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="status-bar__section">
          <span>
            {nodeCount} node{nodeCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>
            {edgeCount} wire{edgeCount !== 1 ? 's' : ''}
          </span>
          <span>·</span>
          <span>{activeView === 'physical' ? 'PHY' : 'SCH'}</span>
        </div>
      </div>
    </section>
  );
}
