import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { HardwareIcon } from './HardwareIcon';

interface ComponentItem {
  id: string;
  name: string;
  description: string;
  category: 'pickup' | 'switch' | 'pot' | 'passive' | 'output';
}

const COMPONENTS: ComponentItem[] = [
  {
    id: 'pickup_sc',
    name: 'Single Coil',
    description: 'Standard single-coil pickup',
    category: 'pickup',
  },
  {
    id: 'pickup_hb',
    name: 'Humbucker',
    description: 'Dual-coil humbucker',
    category: 'pickup',
  },
  {
    id: 'switch_3way',
    name: '3-Way Toggle',
    description: '1 pole, 3 positions',
    category: 'switch',
  },
  {
    id: 'switch_4way',
    name: '4-Way Switch',
    description: '2 poles, 4 positions',
    category: 'switch',
  },
  {
    id: 'switch_5way',
    name: '5-Way Blade',
    description: '2 poles, 5 positions',
    category: 'switch',
  },
  {
    id: 'switch_dpdt',
    name: 'DPDT Push-Pull',
    description: 'Phase reversal switch',
    category: 'switch',
  },
  {
    id: 'pot_volume',
    name: 'Volume Pot',
    description: '250K–500K range',
    category: 'pot',
  },
  { id: 'pot_tone', name: 'Tone Pot', description: 'With tone cap', category: 'pot' },
  {
    id: 'pot_blend',
    name: 'Blend Pot',
    description: 'Pickup blend control',
    category: 'pot',
  },
  {
    id: 'pot_concentric',
    name: 'Concentric Pot',
    description: 'Dual stacked control',
    category: 'pot',
  },
  {
    id: 'wire',
    name: 'Hookup Wire',
    description: 'Standalone adjustable wire',
    category: 'passive',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Tone / treble bleed',
    category: 'passive',
  },
  {
    id: 'resistor',
    name: 'Resistor',
    description: 'Signal attenuation',
    category: 'passive',
  },
  {
    id: 'output_jack',
    name: 'Output Jack',
    description: '1/4" mono jack',
    category: 'output',
  },
];

const GROUPS = [
  { key: 'pickup' as const, label: 'Pickups' },
  { key: 'switch' as const, label: 'Switches' },
  { key: 'pot' as const, label: 'Potentiometers' },
  { key: 'passive' as const, label: 'Passive Components' },
  { key: 'output' as const, label: 'Output' },
];

export function ComponentLibrary() {
  const [_dragItem, setDragItem] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const toggleSidebar = useCanvasStore((s) => s.toggleSidebar);

  if (!isSidebarOpen) return null;

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <aside className="sidebar neu-panel" id="component-library">
      <div
        className="sidebar__header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span className="sidebar__title">Components</span>
        <button
          onClick={toggleSidebar}
          style={closeButtonStyle}
          title="Close Component Library Panel"
        >
          ✕
        </button>
      </div>

      {GROUPS.map((group) => {
        const items = COMPONENTS.filter((c) => c.category === group.key);
        if (items.length === 0) return null;
        const isCollapsed = collapsedGroups[group.key] ?? false;

        return (
          <div className="component-group" key={group.key} style={{ marginBottom: 8 }}>
            <button
              onClick={() => toggleGroup(group.key)}
              className="component-group__label"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                color: '#d4d4d8',
                textAlign: 'left',
              }}
            >
              <span>{group.label}</span>
              <span style={{ fontSize: 10, color: '#a1a1aa' }}>{isCollapsed ? '▶' : '▼'}</span>
            </button>

            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
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
                      <HardwareIcon id={item.id} />
                    </div>
                    <div className="component-card__info">
                      <span className="component-card__name">{item.name}</span>
                      <span className="component-card__desc">{item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

const closeButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  backgroundColor: '#27272a',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  fontSize: 11,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
