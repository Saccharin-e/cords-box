import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';

interface ComponentItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'pickup' | 'switch' | 'pot' | 'passive' | 'output';
}

const COMPONENTS: ComponentItem[] = [
  { id: 'pickup_sc', name: 'Single Coil', description: 'Standard single-coil pickup', icon: '🎸', category: 'pickup' },
  { id: 'pickup_hb', name: 'Humbucker', description: 'Dual-coil humbucker', icon: '🎸', category: 'pickup' },
  { id: 'switch_3way', name: '3-Way Toggle', description: '1 pole, 3 positions', icon: '🔀', category: 'switch' },
  { id: 'switch_4way', name: '4-Way Switch', description: '2 poles, 4 positions', icon: '🔀', category: 'switch' },
  { id: 'switch_5way', name: '5-Way Blade', description: '2 poles, 5 positions', icon: '🔀', category: 'switch' },
  { id: 'switch_dpdt', name: 'DPDT Push-Pull', description: 'Phase reversal switch', icon: '🔀', category: 'switch' },
  { id: 'pot_volume', name: 'Volume Pot', description: '250K–500K range', icon: '🎛️', category: 'pot' },
  { id: 'pot_tone', name: 'Tone Pot', description: 'With tone cap', icon: '🎛️', category: 'pot' },
  { id: 'pot_blend', name: 'Blend Pot', description: 'Pickup blend control', icon: '🎛️', category: 'pot' },
  { id: 'pot_concentric', name: 'Concentric Pot', description: 'Dual stacked control', icon: '🎛️', category: 'pot' },
  { id: 'capacitor', name: 'Capacitor', description: 'Tone / treble bleed', icon: '⚡', category: 'passive' },
  { id: 'resistor', name: 'Resistor', description: 'Signal attenuation', icon: '⚡', category: 'passive' },
  { id: 'output_jack', name: 'Output Jack', description: '1/4" mono jack', icon: '🔌', category: 'output' },
];

const GROUPS = [
  { key: 'pickup' as const, label: 'Pickups', icon: '🎸' },
  { key: 'switch' as const, label: 'Switches', icon: '🔀' },
  { key: 'pot' as const, label: 'Potentiometers', icon: '🎛️' },
  { key: 'passive' as const, label: 'Passive Components', icon: '⚡' },
  { key: 'output' as const, label: 'Output', icon: '🔌' },
];

export function ComponentLibrary() {
  const [_dragItem, setDragItem] = useState<string | null>(null);
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const toggleSidebar = useCanvasStore((s) => s.toggleSidebar);

  if (!isSidebarOpen) {
    return (
      <aside
        className="sidebar neu-panel"
        id="component-library"
        style={{
          width: 48,
          minWidth: 48,
          padding: '12px 6px',
          alignItems: 'center',
          gap: 16,
          transition: 'all 0.25s ease',
        }}
      >
        <button
          onClick={toggleSidebar}
          style={toggleButtonStyle}
          title="Expand Component Library Panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          {GROUPS.map((g) => (
            <div
              key={g.key}
              onClick={toggleSidebar}
              style={{
                fontSize: 18,
                cursor: 'pointer',
                textAlign: 'center',
                opacity: 0.8,
                transition: 'transform 0.15s ease',
              }}
              title={`Expand Library: ${g.label}`}
            >
              {g.icon}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar neu-panel" id="component-library" style={{ transition: 'all 0.25s ease' }}>
      <div className="sidebar__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="sidebar__title">Components</span>
        <button
          onClick={toggleSidebar}
          style={toggleButtonStyle}
          title="Collapse Component Library Panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {GROUPS.map((group) => {
        const items = COMPONENTS.filter((c) => c.category === group.key);
        if (items.length === 0) return null;
        return (
          <div className="component-group" key={group.key}>
            <div className="component-group__label">{group.label}</div>
            {items.map((item) => (
              <div
                key={item.id}
                className="component-card"
                draggable
                onDragStart={(e) => {
                  setDragItem(item.id);
                  e.dataTransfer.setData('componentId', item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onDragEnd={() => setDragItem(null)}
                id={`component-${item.id}`}
              >
                <div className={`component-card__icon component-card__icon--${item.category}`}>
                  {item.icon}
                </div>
                <div className="component-card__info">
                  <span className="component-card__name">{item.name}</span>
                  <span className="component-card__desc">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </aside>
  );
}

const toggleButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  backgroundColor: '#27272a',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
