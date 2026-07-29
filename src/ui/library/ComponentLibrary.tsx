import { useState } from 'react';

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

  return (
    <aside className="sidebar" id="component-library">
      <div className="sidebar__header">
        <span className="sidebar__title">Components</span>
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
                onDragStart={() => setDragItem(item.id)}
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
