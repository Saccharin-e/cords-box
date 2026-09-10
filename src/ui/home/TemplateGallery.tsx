import { useState } from 'react';
import { useProjectStore } from '@store/projectStore';
import { PRESETS } from '@presets/presetLibrary';
import { Button } from '../common/Button';
import { Wrench } from 'lucide-react';

type FilterCategory = 'all' | 'strat' | 'tele' | 'les_paul' | 'bass';

interface TemplateCardInfo {
  id: string;
  name: string;
  category: FilterCategory;
  tag: string;
  pickupConfig: string;
  switchType: string;
  potsConfig: string;
  description: string;
  accentColor: string;
}

const TEMPLATE_METADATA: Record<string, Omit<TemplateCardInfo, 'id' | 'name' | 'description'>> = {
  guitar_sound_test_template: {
    category: 'strat',
    tag: 'Test Bench',
    pickupConfig: 'HSS (Single / Single / PAF Humbucker)',
    switchType: '5-Way Blade Selector',
    potsConfig: 'A250K Master Vol + B250K Master Tone',
    accentColor: '#dc2626',
  },
  strat_sss: {
    category: 'strat',
    tag: 'Vintage Classic',
    pickupConfig: 'SSS (Vintage Alnico V Single Coils)',
    switchType: '5-Way Blade Selector',
    potsConfig: 'A250K Vol + Neck Tone + Mid Tone',
    accentColor: '#d97706',
  },
  indie_rock_tele: {
    category: 'tele',
    tag: 'Modern Series/Parallel',
    pickupConfig: 'SS (Tele Neck + High-Output Bridge)',
    switchType: '4-Way Blade + Phase Push-Pull',
    potsConfig: 'A250K Vol + Concentric Blend/Tone',
    accentColor: '#0284c7',
  },
  std_tele: {
    category: 'tele',
    tag: '1952 Traditional',
    pickupConfig: 'SS (Twang Neck + Lead Bridge)',
    switchType: '3-Way Blade Selector',
    potsConfig: 'A250K Vol + B250K Tone (.047µF)',
    accentColor: '#16a34a',
  },
  les_paul_hh: {
    category: 'les_paul',
    tag: '1959 Vintage Burst',
    pickupConfig: 'HH (Dual PAF Humbuckers 8.2k/8.8k)',
    switchType: '3-Way Toggle Switch',
    potsConfig: '2x A500K Vol + 2x A500K Tone (50s Wiring)',
    accentColor: '#7c3aed',
  },
  p_bass: {
    category: 'bass',
    tag: 'Classic Thump',
    pickupConfig: 'Split-Coil Precision Bass (10.5k)',
    switchType: 'Direct Output',
    potsConfig: 'A250K Vol + A250K Tone (.047µF)',
    accentColor: '#db2777',
  },
  jazz_bass: {
    category: 'bass',
    tag: 'Growl & Clarity',
    pickupConfig: 'Dual Single-Coil Jazz Bass Pickups',
    switchType: 'Dual Volume Blend',
    potsConfig: '2x A250K Vol + A250K Master Tone',
    accentColor: '#0891b2',
  },
};

export function TemplateGallery() {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const startProjectFromTemplate = useProjectStore((s) => s.startProjectFromTemplate);

  const filteredPresets = PRESETS.filter((preset) => {
    if (filter === 'all') return true;
    const meta = TEMPLATE_METADATA[preset.id];
    return meta?.category === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Header & Category Filter Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#f4f4f5' }}>
            Starter Wiring Templates
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa' }}>
            Choose a standard guitar or bass circuit harness to initialize your project.
          </p>
        </div>

        {/* Filter Pills */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            padding: '3px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {(
            [
              { id: 'all', label: 'All Models' },
              { id: 'strat', label: 'Stratocaster' },
              { id: 'tele', label: 'Telecaster' },
              { id: 'les_paul', label: 'Les Paul' },
              { id: 'bass', label: 'Bass Guitars' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              style={{
                background: filter === item.id ? '#27272a' : 'transparent',
                color: filter === item.id ? '#ffffff' : '#a1a1aa',
                border:
                  filter === item.id
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid transparent',
                borderRadius: '4px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Template Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredPresets.map((preset) => {
          const meta = TEMPLATE_METADATA[preset.id] || {
            category: 'strat',
            tag: 'Custom Template',
            pickupConfig: 'Custom Wiring',
            switchType: 'Custom Switch',
            potsConfig: 'Standard Controls',
            accentColor: '#dc2626',
          };

          return (
            <div
              key={preset.id}
              style={{
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 24, 27, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(0, 0, 0, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Top Accent Strip */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: meta.accentColor,
                }}
              />

              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: `${meta.accentColor}20`,
                      color: meta.accentColor,
                      letterSpacing: '0.4px',
                    }}
                  >
                    {meta.tag}
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>
                    {preset.components.length} components
                  </span>
                </div>

                <h3
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#f4f4f5',
                  }}
                >
                  {preset.name}
                </h3>

                <p
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: '#a1a1aa',
                  }}
                >
                  {preset.description}
                </p>

                {/* Specs List */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#d4d4d8',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div>
                    <strong style={{ color: '#a1a1aa' }}>Pickups:</strong> {meta.pickupConfig}
                  </div>
                  <div>
                    <strong style={{ color: '#a1a1aa' }}>Switching:</strong> {meta.switchType}
                  </div>
                  <div>
                    <strong style={{ color: '#a1a1aa' }}>Controls:</strong> {meta.potsConfig}
                  </div>
                </div>
              </div>

              {/* Start Making button */}
              <Button
                variant="primary"
                onClick={() => startProjectFromTemplate(preset.id, preset.name)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '5px',
                  backgroundColor: meta.accentColor,
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Wrench size={13} />
                <span>Start Making on This Project</span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
