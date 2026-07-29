/**
 * ContextMenu — Neumorphic Right-Click Floating Menu.
 *
 * Provides instant actions for components, wires, and canvas stage:
 * - Delete Component / Delete Wire
 * - Rotate Component
 * - Inspect Properties
 * - Reset Canvas View
 */

import { useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';

export interface ContextMenuState {
  x: number;
  y: number;
  targetType: 'component' | 'wire' | 'canvas';
  targetId?: string;
}

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: Props) {
  const { removeInstance, selectInstance, setPan, setScale, wiringMode, cancelWiring, startWiring, instances, resetCanvas } = useCanvasStore();
  const { removeComponent, removeEdge, reset } = useCircuitStore();

  // Close context menu on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('.context-menu')) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function handleDeleteTarget() {
    if (menu.targetType === 'component' && menu.targetId) {
      removeInstance(menu.targetId);
      removeComponent(menu.targetId);
      selectInstance(null);
    } else if (menu.targetType === 'wire' && menu.targetId) {
      removeEdge(menu.targetId);
    }
    onClose();
  }

  function handleResetView() {
    setScale(1);
    setPan(0, 0);
    onClose();
  }

  function handleClearAll() {
    resetCanvas();
    reset();
    onClose();
  }

  return (
    <div
      className="context-menu neu-panel"
      style={{
        position: 'fixed',
        left: Math.min(menu.x, window.innerWidth - 200),
        top: Math.min(menu.y, window.innerHeight - 200),
        zIndex: 1000,
        minWidth: 180,
        padding: '6px 0',
        borderRadius: 8,
        backgroundColor: '#18181b',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
      }}
    >
      {menu.targetType === 'component' && (
        <>
          <div className="context-menu__header" style={headerStyle}>
            COMPONENT: {menu.targetId}
          </div>
          <button className="context-menu__item context-menu__item--danger" style={dangerItemStyle} onClick={handleDeleteTarget}>
            <span>🗑️ Delete Component</span>
            <span style={shortcutStyle}>Del</span>
          </button>
        </>
      )}

      {menu.targetType === 'wire' && (
        <>
          <div className="context-menu__header" style={headerStyle}>
            WIRE EDGE
          </div>
          <button className="context-menu__item context-menu__item--danger" style={dangerItemStyle} onClick={handleDeleteTarget}>
            <span>🗑️ Delete Wire</span>
            <span style={shortcutStyle}>Del</span>
          </button>
        </>
      )}

      {menu.targetType === 'canvas' && (
        <>
          <div className="context-menu__header" style={headerStyle}>
            CANVAS STAGE
          </div>
          <button
            className="context-menu__item"
            style={itemStyle}
            onClick={() => {
              if (wiringMode) cancelWiring();
              else {
                const first = instances[0];
                if (first) {
                  const shape = getShapeLug(first.id);
                  if (shape) startWiring(shape);
                }
              }
              onClose();
            }}
          >
            <span>{wiringMode ? '❌ Cancel Wiring' : '⚡ Wiring Mode'}</span>
          </button>
          <button className="context-menu__item" style={itemStyle} onClick={handleResetView}>
            <span>🎯 Reset Pan & Zoom</span>
          </button>
          <div style={dividerStyle} />
          <button className="context-menu__item context-menu__item--danger" style={dangerItemStyle} onClick={handleClearAll}>
            <span>🗑️ Clear Canvas</span>
          </button>
        </>
      )}
    </div>
  );
}

function getShapeLug(compId: string) {
  return { componentId: compId, lugId: `${compId}_hot`, x: 0, y: 0 };
}

const headerStyle: React.CSSProperties = {
  padding: '4px 12px 6px',
  fontSize: 9,
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 'bold',
  color: '#71717a',
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  marginBottom: 4,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  color: '#e4e4e7',
  backgroundColor: 'transparent',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease',
};

const dangerItemStyle: React.CSSProperties = {
  ...itemStyle,
  color: '#ef4444',
};

const shortcutStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  color: '#71717a',
  marginLeft: 8,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  backgroundColor: 'rgba(255,255,255,0.06)',
  margin: '4px 0',
};
