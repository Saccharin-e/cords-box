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
import { TabPanel } from '../tab/TabPanel';

export function DualCanvas() {
  const containerRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const activeView = useCanvasStore((s) => s.activeView);
  const setActiveView = useCanvasStore((s) => s.setActiveView);
  const instancesCount = useCanvasStore((s) => s.instances.length);
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const isTestPanelOpen = useCanvasStore((s) => s.isTestPanelOpen);
  const isAmpPanelOpen = useCanvasStore((s) => s.isAmpPanelOpen);
  const isFretboardOpen = useCanvasStore((s) => s.isFretboardOpen);
  const isSlotModalOpen = useCanvasStore((s) => s.isSlotModalOpen);
  const isTabPanelOpen = useCanvasStore((s) => s.isTabPanelOpen);
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

  // Dedicated Pan & Zoom state for Sound Systems Workspace (Isolates placement from Physical view)
  const [soundScale, setSoundScale] = useState(1);
  const [soundPan, setSoundPan] = useState({ x: 0, y: 0 });

  // Zoom & Pan Handlers for Sound Systems Canvas Workspace
  const handleWheelSoundSystems = (e: React.WheelEvent) => {
    e.preventDefault();
    const oldScale = soundScale;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(2.5, Math.max(0.4, oldScale * zoomFactor));

    const mousePointTo = {
      x: (pointerX - soundPan.x) / oldScale,
      y: (pointerY - soundPan.y) / oldScale,
    };

    const newPanX = pointerX - mousePointTo.x * newScale;
    const newPanY = pointerY - mousePointTo.y * newScale;

    setSoundScale(newScale);
    setSoundPan({ x: newPanX, y: newPanY });
  };

  const [isPanningBg, setIsPanningBg] = useState(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 });

  const handlePointerDownBg = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.neu-panel') ||
      target.closest('.guitar-sound-panel') ||
      target.closest('.amp-pedalboard-panel') ||
      target.closest('.playable-fretboard-panel') ||
      target.closest('.tab-panel') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea')
    ) {
      return;
    }

    setIsPanningBg(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panX: soundPan.x,
      panY: soundPan.y,
    };
  };

  useEffect(() => {
    if (!isPanningBg) return;

    function handlePointerMove(e: PointerEvent) {
      const dx = e.clientX - panStartRef.current.mouseX;
      const dy = e.clientY - panStartRef.current.mouseY;
      setSoundPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    }

    function handlePointerUp() {
      setIsPanningBg(false);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPanningBg]);

  function handleResetView() {
    if (activeView === 'sound_systems') {
      setSoundScale(1);
      setSoundPan({ x: 0, y: 0 });
    } else {
      setScale(1);
      setPan(size.width / 2, size.height / 2);
    }
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
        <button
          className={`canvas-tab ${activeView === 'sound_systems' ? 'canvas-tab--active' : ''}`}
          onClick={() => setActiveView('sound_systems')}
          id="tab-soundsystems"
        >
          Sound Systems
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
      {size.width > 0 && activeView !== 'sound_systems' && (
        <>
          {activeView === 'physical' ? (
            <PhysicalView width={size.width} height={size.height} />
          ) : (
            <SchematicView width={size.width} height={size.height} />
          )}
        </>
      )}

      {/* Sound Systems Component Window Workspace */}
      {activeView === 'sound_systems' && (
        <div
          onWheel={handleWheelSoundSystems}
          onPointerDown={handlePointerDownBg}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            cursor: isPanningBg ? 'grabbing' : 'default',
            userSelect: isPanningBg ? 'none' : 'auto',
            backgroundColor: '#121214',
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
              radial-gradient(circle, rgba(255, 255, 255, 0.07) 1px, transparent 1px)
            `,
            backgroundSize: `${40 * soundScale}px ${40 * soundScale}px, ${40 * soundScale}px ${40 * soundScale}px, ${10 * soundScale}px ${10 * soundScale}px`,
            backgroundPosition: `${soundPan.x}px ${soundPan.y}px, ${soundPan.x}px ${soundPan.y}px, ${soundPan.x}px ${soundPan.y}px`,
          }}
        >
          {/* Carbon Fiber Micro-Mesh Overlay Texture (Follows Canvas Drag) */}
          <div
            style={{
              position: 'absolute',
              inset: -2000,
              opacity: 0.12,
              pointerEvents: 'none',
              backgroundImage: `repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 0, transparent 8px)`,
              transform: `translate3d(${soundPan.x}px, ${soundPan.y}px, 0)`,
            }}
          />

          {/* Zoomable & Pannable Canvas Surface */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              transform: `translate3d(${soundPan.x}px, ${soundPan.y}px, 0) scale(${soundScale})`,
              transformOrigin: '0 0',
              pointerEvents: 'none',
            }}
          >
            <div style={{ pointerEvents: 'auto' }}>
              {/* Retractable Guitar Audio Test Panel */}
              {isTestPanelOpen && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveFloatingPanel('test');
                  }}
                  style={{
                    position: 'absolute',
                    top: 40,
                    left: 40,
                    zIndex: activeFloatingPanel === 'test' ? 100 : 90,
                  }}
                >
                  <GuitarSoundTestPanel />
                </div>
              )}

              {/* Retractable Amp Simulator & Pedalboard Panel */}
              {isAmpPanelOpen && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveFloatingPanel('amp');
                  }}
                  style={{
                    position: 'absolute',
                    top: 40,
                    left: 440,
                    zIndex: activeFloatingPanel === 'amp' ? 100 : 95,
                  }}
                >
                  <AmpPedalboardPanel />
                </div>
              )}

              {/* Retractable Interactive Playable Fretboard Panel */}
              {isFretboardOpen && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveFloatingPanel('fretboard');
                  }}
                  style={{
                    position: 'absolute',
                    top: 40,
                    left: 1000,
                    zIndex: activeFloatingPanel === 'fretboard' ? 100 : 96,
                  }}
                >
                  <PlayableFretboardPanel />
                </div>
              )}

              {/* Draggable Tab Player Panel */}
              {isTabPanelOpen && (
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveFloatingPanel('tab');
                  }}
                  style={{
                    position: 'absolute',
                    top: 460,
                    left: 40,
                    zIndex: activeFloatingPanel === 'tab' ? 100 : 97,
                  }}
                >
                  <TabPanel />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saveable Layout Slots & Circuit Template Modal */}
      {isSlotModalOpen && <LayoutSlotsModal />}

      {/* Empty state overlay */}
      {isEmpty && activeView !== 'sound_systems' && (
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
