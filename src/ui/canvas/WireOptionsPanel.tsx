/**
 * WireOptionsPanel — DIYLC-Style Wire Configuration Toolbar
 *
 * Appears when wiring mode is active. Allows selecting:
 * - Wire color (palette grid)
 * - Wire type (cloth pushback, vinyl, shielded, bare)
 * - Connection type (solder, quick connect, crimp, twist)
 */

import { useCanvasStore, WIRE_COLOR_PRESETS } from '@store/canvasStore';
import type { WireDrawType } from '@store/canvasStore';
import { X } from 'lucide-react';

const WIRE_TYPES: { id: WireDrawType; label: string; desc: string }[] = [
  { id: 'vintage_cloth_pushback', label: 'Cloth', desc: 'Vintage pushback' },
  { id: 'modern_vinyl', label: 'Vinyl', desc: 'Modern PVC' },
  { id: 'shielded', label: 'Shielded', desc: 'Braided shield' },
  { id: 'bare', label: 'Bare', desc: 'Solid copper' },
];

const CONNECTION_TYPES = [
  { id: 'solder', label: 'Solder' },
  { id: 'quick_connect', label: 'Quick' },
  { id: 'crimp', label: 'Crimp' },
  { id: 'twist', label: 'Twist' },
] as const;

export function WireOptionsPanel() {
  const wiringMode = useCanvasStore((s) => s.wiringMode);
  const wireDrawOptions = useCanvasStore((s) => s.wireDrawOptions);
  const setWireDrawOptions = useCanvasStore((s) => s.setWireDrawOptions);
  const cancelWiring = useCanvasStore((s) => s.cancelWiring);

  if (!wiringMode) return null;

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span>WIRE TOOL</span>
        </div>
        <button onClick={cancelWiring} style={closeBtnStyle} title="Exit Wiring Mode (Esc)">
          <X size={14} />
        </button>
      </div>

      {/* Color Grid */}
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Color</div>
        <div style={colorGridStyle}>
          {WIRE_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              title={preset.label}
              onClick={() => setWireDrawOptions({ color: preset.hex })}
              style={{
                width: 22,
                height: 22,
                borderRadius: 2,
                border:
                  wireDrawOptions.color === preset.hex ? '2px solid #f4f4f5' : '1px solid #3f3f46',
                backgroundColor: preset.hex,
                cursor: 'pointer',
                boxShadow: wireDrawOptions.color === preset.hex ? `0 0 6px ${preset.hex}` : 'none',
                transition: 'all 0.1s ease',
              }}
            />
          ))}
        </div>
        {/* Current color preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <div
            style={{
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: wireDrawOptions.color,
            }}
          />
          <span style={{ fontSize: 10, color: '#a1a1aa' }}>
            {WIRE_COLOR_PRESETS.find((p) => p.hex === wireDrawOptions.color)?.label ?? 'Custom'}
          </span>
        </div>
      </div>

      {/* Wire Type */}
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Type</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {WIRE_TYPES.map((wt) => (
            <button
              key={wt.id}
              onClick={() => setWireDrawOptions({ wireType: wt.id })}
              title={wt.desc}
              style={{
                ...chipStyle,
                ...(wireDrawOptions.wireType === wt.id ? chipActiveStyle : {}),
              }}
            >
              {wt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connection Type */}
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>Joint</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {CONNECTION_TYPES.map((ct) => (
            <button
              key={ct.id}
              onClick={() => setWireDrawOptions({ connectionType: ct.id })}
              style={{
                ...chipStyle,
                ...(wireDrawOptions.connectionType === ct.id ? chipActiveStyle : {}),
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div style={{ fontSize: 9, color: '#71717a', lineHeight: 1.4, marginTop: 4 }}>
        Click a lug to start, click another lug to connect. Press <kbd style={kbdStyle}>Esc</kbd> to
        cancel.
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 60,
  left: 12,
  width: 180,
  backgroundColor: '#18181b',
  border: '1px solid #27272a',
  borderRadius: 6,
  padding: 10,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 10,
  fontWeight: 800,
  fontFamily: "'JetBrains Mono', monospace",
  color: '#d97706',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  paddingBottom: 6,
  borderBottom: '1px solid #27272a',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#71717a',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
};

const sectionStyle: React.CSSProperties = {};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 4,
};

const colorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 4,
};

const chipStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "'JetBrains Mono', monospace",
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 3,
  color: '#a1a1aa',
  cursor: 'pointer',
  transition: 'all 0.1s ease',
};

const chipActiveStyle: React.CSSProperties = {
  backgroundColor: '#d97706',
  borderColor: '#d97706',
  color: '#18181b',
};

const kbdStyle: React.CSSProperties = {
  padding: '1px 4px',
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 2,
  fontSize: 9,
  fontFamily: "'JetBrains Mono', monospace",
};
