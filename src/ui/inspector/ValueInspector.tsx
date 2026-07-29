/**
 * ValueInspector — Component property editor.
 *
 * Shows editable fields for the selected component:
 * - Label rename
 * - Capacitor: capacitance (pF / µF)
 * - Resistor: resistance (Ω / kΩ)
 * - Potentiometer: resistance (kΩ), taper, and position slider
 * - Wiring diagnostics from the linter
 * - Retractable panel support (48px dock mode)
 */

import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { lintCircuit } from '@lint/linter';
import type { LintDiagnostic } from '@lint/linter';
import type { PotentiometerValue, CapacitorValue, ResistorValue } from '@graph/types';

export function ValueInspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const instances = useCanvasStore((s) => s.instances);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const toggleInspector = useCanvasStore((s) => s.toggleInspector);

  const graph = useCircuitStore((s) => s.graph);
  const diagnostics = lintCircuit(graph);

  const removeInstance = useCanvasStore((s) => s.removeInstance);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const removeComponent = useCircuitStore((s) => s.removeComponent);

  const inst = instances.find((i) => i.id === selectedId);
  const component = inst ? graph.getComponent(inst.id) : undefined;

  function handleDelete() {
    if (!selectedId) return;
    removeInstance(selectedId);
    removeComponent(selectedId);
    selectInstance(null);
  }

  if (!isInspectorOpen) {
    return (
      <aside
        className="inspector neu-panel"
        id="inspector-panel"
        style={{
          width: 48,
          minWidth: 48,
          padding: '12px 6px',
          alignItems: 'center',
          gap: 16,
          transition: 'all 0.25s ease',
        }}
      >
        {/* Click arrow to expand left into workspace */}
        <button
          onClick={toggleInspector}
          style={toggleButtonStyle}
          title="Expand Inspector Panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div
          onClick={toggleInspector}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginTop: 8,
            cursor: 'pointer',
          }}
          title="Expand Inspector Panel"
        >
          <div style={{ fontSize: 18 }} title="Component Inspector">🎛️</div>

          {/* Corrected orientation: reads naturally top-to-bottom */}
          <div
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              textTransform: 'uppercase',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.15em',
              color: '#a1a1aa',
              whiteSpace: 'nowrap',
            }}
          >
            INSPECTOR {component ? `• ${component.label}` : ''}
          </div>

          {diagnostics.length > 0 && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 8px #f59e0b',
              }}
              title={`${diagnostics.length} wiring warning(s)`}
            />
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="inspector neu-panel" id="inspector-panel" style={{ transition: 'all 0.25s ease' }}>
      <div className="inspector__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="inspector__title">Inspector</span>
        {/* Click arrow to collapse right off-screen */}
        <button
          onClick={toggleInspector}
          style={toggleButtonStyle}
          title="Collapse Inspector Panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Component details when selected */}
      {component ? (
        <div style={{ padding: '0 var(--space-4)', flex: 1, overflowY: 'auto' }}>
          <InspectorSection title="Identity">
            <InspectorRow label="ID">
              <span className="inspector-mono">{component.id}</span>
            </InspectorRow>
            <InspectorRow label="Type">
              <span className="inspector-mono">{component.type}</span>
            </InspectorRow>
            <InspectorRow label="Label">
              <span className="inspector-mono">{component.label}</span>
            </InspectorRow>
            <div style={{ marginTop: 12 }}>
              <button
                className="neu-btn neu-btn--danger"
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: 12,
                  color: '#ef4444',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
                onClick={handleDelete}
              >
                <span>🗑️ Delete Component</span>
              </button>
            </div>
          </InspectorSection>

          {/* Potentiometer controls */}
          {(component.type === 'pot_volume' ||
            component.type === 'pot_tone' ||
            component.type === 'pot_blend' ||
            component.type === 'pot_concentric') && (
              <PotentiometerInspector
                compId={component.id}
                value={component.value as PotentiometerValue | undefined}
              />
            )}

          {/* Capacitor controls */}
          {component.type === 'capacitor' && (
            <CapacitorInspector
              compId={component.id}
              value={component.value as CapacitorValue | undefined}
            />
          )}

          {/* Resistor controls */}
          {component.type === 'resistor' && (
            <ResistorInspector
              compId={component.id}
              value={component.value as ResistorValue | undefined}
            />
          )}
        </div>
      ) : (
        <div
          style={{
            padding: 'var(--space-4)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center',
          }}
        >
          Select a component on the canvas to inspect and edit its physical properties.
        </div>
      )}

      {/* Diagnostics / Linter Section */}
      <div
        style={{
          borderTop: '1px solid var(--color-bg-inset)',
          padding: 'var(--space-3) var(--space-4)',
        }}
      >
        <div className="inspector__section-title">Wiring Diagnostics</div>
        {diagnostics.length === 0 ? (
          <div style={{ color: 'var(--color-accent-green)', fontSize: 11 }}>
            ✓ No wiring defects detected.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
            {diagnostics.map((d, i) => (
              <DiagnosticItem key={i} diagnostic={d} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="inspector__section-title">{title}</div>
      {children}
    </div>
  );
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      {children}
    </div>
  );
}

function PotentiometerInspector({
  compId,
  value,
}: {
  compId: string;
  value?: PotentiometerValue;
}) {
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);

  const resistance = value?.resistance_kohms ?? 250;
  const taper = value?.taper ?? 'audio';
  const position = value?.position ?? 1.0;

  function handlePositionChange(pos: number) {
    updateComponentValue(compId, { resistance_kohms: resistance, taper, position: pos });
  }

  function handleResistanceChange(res: number) {
    updateComponentValue(compId, { resistance_kohms: res, taper, position });
  }

  function handleTaperChange(t: 'audio' | 'linear') {
    updateComponentValue(compId, { resistance_kohms: resistance, taper: t, position });
  }

  return (
    <InspectorSection title="Potentiometer Settings">
      <InspectorRow label="Resistance">
        <select
          className="inspector-select"
          value={resistance}
          onChange={(e) => handleResistanceChange(Number(e.target.value))}
        >
          <option value={250}>250kΩ (Single Coil)</option>
          <option value={500}>500kΩ (Humbucker)</option>
          <option value={1000}>1MΩ (Bright)</option>
          <option value={25}>25kΩ (Active)</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Taper">
        <select
          className="inspector-select"
          value={taper}
          onChange={(e) => handleTaperChange(e.target.value as 'audio' | 'linear')}
        >
          <option value="audio">Audio (Log A)</option>
          <option value="linear">Linear (B)</option>
        </select>
      </InspectorRow>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
          <span>Knob Position</span>
          <span className="inspector-mono">{Math.round(position * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={position}
          onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-accent-amber)' }}
        />
      </div>
    </InspectorSection>
  );
}

function CapacitorInspector({
  compId,
  value,
}: {
  compId: string;
  value?: CapacitorValue;
}) {
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);

  const capacitance = value?.capacitance_pf ?? 47000;

  function handleChange(val: number) {
    updateComponentValue(compId, { capacitance_pf: val });
  }

  return (
    <InspectorSection title="Capacitor Settings">
      <InspectorRow label="Capacitance">
        <select
          className="inspector-select"
          value={capacitance}
          onChange={(e) => handleChange(Number(e.target.value))}
        >
          <option value={47000}>.047 µF (Fender Spec)</option>
          <option value={22000}>.022 µF (Gibson Spec)</option>
          <option value={1000}>.001 µF (Treble Bleed)</option>
          <option value={100000}>.1 µF (Dark Warm)</option>
        </select>
      </InspectorRow>
    </InspectorSection>
  );
}

function ResistorInspector({
  compId,
  value,
}: {
  compId: string;
  value?: ResistorValue;
}) {
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const resistance = value?.resistance_ohms ?? 150000;

  function handleChange(val: number) {
    updateComponentValue(compId, { resistance_ohms: val });
  }

  return (
    <InspectorSection title="Resistor Settings">
      <InspectorRow label="Resistance">
        <select
          className="inspector-select"
          value={resistance}
          onChange={(e) => handleChange(Number(e.target.value))}
        >
          <option value={150000}>150 kΩ (Treble Bleed)</option>
          <option value={470000}>470 kΩ (Load Resistor)</option>
          <option value={1000000}>1 MΩ (Isolation)</option>
        </select>
      </InspectorRow>
    </InspectorSection>
  );
}

function DiagnosticItem({ diagnostic }: { diagnostic: LintDiagnostic }) {
  const colorMap = {
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
  };

  return (
    <div
      style={{
        fontSize: 11,
        padding: '4px 6px',
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderLeft: `3px solid ${colorMap[diagnostic.severity]}`,
      }}
    >
      <div style={{ fontWeight: 600, color: colorMap[diagnostic.severity] }}>
        {diagnostic.severity.toUpperCase()}: {diagnostic.code}
      </div>
      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {diagnostic.message}
      </div>
    </div>
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
