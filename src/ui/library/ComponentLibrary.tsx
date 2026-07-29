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
  { key: 'pickup' as const, label: 'Pickups' },
  { key: 'switch' as const, label: 'Switches' },
  { key: 'pot' as const, label: 'Potentiometers' },
  { key: 'passive' as const, label: 'Passive Components' },
  { key: 'output' as const, label: 'Output' },
];

export function ComponentLibrary() {
  const [_dragItem, setDragItem] = useState<string | null>(null);
  const isSidebarOpen = useCanvasStore((s) => s.isSidebarOpen);
  const toggleSidebar = useCanvasStore((s) => s.toggleSidebar);

  if (!isSidebarOpen) return null;

  return (
    <aside className="sidebar neu-panel" id="component-library">
      <div className="sidebar__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
