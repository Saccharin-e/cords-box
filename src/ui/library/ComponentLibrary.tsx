import { useState } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { HardwareIcon } from './HardwareIcon';

interface ComponentItem {
  id: string;
  name: string;
  description: string;
  category: 'pickup' | 'switch' | 'pot' | 'passive' | 'doc' | 'shapes' | 'output';
}

const COMPONENTS: ComponentItem[] = [
  {
    id: 'pickup_sc',
    name: 'Single Coil',
    description: 'Standard single-coil pickup',
    category: 'pickup',
  },
  {
    id: 'pickup_p90',
    name: 'P-90 Soapbar',
    description: 'Vintage high-output P-90',
    category: 'pickup',
  },
  {
    id: 'pickup_hb',
    name: 'Humbucker',
    description: 'Dual-coil noise-canceling pickup',
    category: 'pickup',
  },
  {
    id: 'switch_3way',
    name: '3-Way Toggle',
    description: 'Standard 3-way pickup selector',
    category: 'switch',
  },
  {
    id: 'switch_4way',
    name: '4-Way Switch',
    description: 'Series / parallel 4-way blade switch',
    category: 'switch',
  },
  {
    id: 'switch_5way',
    name: '5-Way Blade',
    description: 'Strat-style 5-position switch',
    category: 'switch',
  },
  {
    id: 'switch_dpdt',
    name: 'DPDT Mini Switch',
    description: '2-position DPDT toggle switch',
    category: 'switch',
  },
  {
    id: 'pot_volume',
    name: 'Volume Pot',
    description: '250K / 500K audio taper pot',
    category: 'pot',
  },
  { id: 'pot_tone', name: 'Tone Pot', description: 'Tone control potentiometer', category: 'pot' },
  {
    id: 'pot_pushpull',
    name: 'Push-Pull Pot',
    description: 'Potentiometer with DPDT switch',
    category: 'pot',
  },
  {
    id: 'pot_blend',
    name: 'Blend Pot',
    description: 'Center-detent pickup blend pot',
    category: 'pot',
  },
  {
    id: 'pot_concentric',
    name: 'Stacked Dual Pot',
    description: 'Concentric dual control pot',
    category: 'pot',
  },
  {
    id: 'battery_9v',
    name: '9V Active Battery',
    description: 'Power supply for active pickups / onboard EQ',
    category: 'passive',
  },
  {
    id: 'ground_terminal',
    name: 'Star Ground Lug',
    description: 'Centralized star grounding point',
    category: 'passive',
  },
  {
    id: 'treble_bleed',
    name: 'Treble Bleed Mod',
    description: 'High-frequency retention module',
    category: 'passive',
  },
  {
    id: 'wire',
    name: 'Hookup Wire',
    description: 'Customizable canvas wire segment',
    category: 'passive',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    description: 'Orange Drop / Film tone cap',
    category: 'passive',
  },
  {
    id: 'resistor',
    name: 'Resistor',
    description: 'Resistor / bleed resistor',
    category: 'passive',
  },
  {
    id: 'text_box',
    name: 'Custom Text Note',
    description: 'Editable text box for notes & instructions',
    category: 'doc',
  },
  {
    id: 'project_card',
    name: 'Project Info Card',
    description: 'Title block with author, model, date & specs',
    category: 'doc',
  },
  {
    id: 'shape_rect',
    name: 'Shielding / Cavity Box',
    description: 'Custom rectangle for shielding foil or cavity bounds',
    category: 'shapes',
  },
  {
    id: 'shape_circle',
    name: 'Drill Hole / Route Circle',
    description: 'Custom circle for drill holes or pickup routes',
    category: 'shapes',
  },
  {
    id: 'shape_line',
    name: 'Guide Line',
    description: 'Dashed or solid alignment line segment',
    category: 'shapes',
  },
  {
    id: 'shape_arrow',
    name: 'Pointer Arrow',
    description: 'Callout pointer arrow with editable text',
    category: 'shapes',
  },
  {
    id: 'output_jack',
    name: '1/4" Output Jack',
    description: 'Standard 1/4" mono output jack',
    category: 'output',
  },
];

const GROUPS = [
  { key: 'pickup' as const, label: 'Pickups' },
  { key: 'switch' as const, label: 'Switches' },
  { key: 'pot' as const, label: 'Potentiometers' },
  { key: 'passive' as const, label: 'Mods & Components' },
  { key: 'doc' as const, label: 'Documentation & Cards' },
  { key: 'shapes' as const, label: 'Free Shapes & Drawing' },
  { key: 'output' as const, label: 'Output Jacks' },
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
