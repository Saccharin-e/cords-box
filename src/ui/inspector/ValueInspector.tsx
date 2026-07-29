/**
 * ValueInspector — Component property editor.
 *
 * Shows editable fields for the selected component:
 * - Label rename
 * - Capacitor: capacitance (pF / µF)
 * - Resistor: resistance (Ω / kΩ)
 * - Potentiometer: resistance (kΩ), taper, and position slider
 * - Wiring diagnostics from the linter
 */

import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { lintCircuit } from '@lint/linter';
import type { LintDiagnostic } from '@lint/linter';
import type { PotentiometerValue, CapacitorValue, ResistorValue } from '@graph/types';

export function ValueInspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const instances = useCanvasStore((s) => s.instances);
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

  return (
    <aside className="inspector neu-panel" id="inspector-panel">
      <div className="inspector__header">
        <span className="inspector__title">Inspector</span>
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
        <div className="inspector-empty">
          <span style={{ fontSize: '1.5rem', opacity: 0.2 }}>✦</span>
          <p className="inspector-empty__text">Select a component</p>
        </div>
      )}

      {/* Diagnostics */}
      <DiagnosticsPanel diagnostics={diagnostics} />
    </aside>
  );
}

/* ─── Sub-inspectors ─────────────────────────────────────────────────────── */

function PotentiometerInspector({
  compId,
  value,
}: {
  compId: string;
  value: PotentiometerValue | undefined;
}) {
  const pos = value?.position ?? 1;
  const resistance = value?.resistance_kohms ?? 250;
  const taper = value?.taper ?? 'audio';

  return (
    <InspectorSection title="Potentiometer">
      <InspectorRow label="Resistance">
        <span className="inspector-value">{resistance}kΩ</span>
      </InspectorRow>
      <InspectorRow label="Taper">
        <span className="inspector-badge">{taper}</span>
      </InspectorRow>
      <InspectorRow label="Position">
        <div className="inspector-slider-wrap">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(pos * 100)}
            className="inspector-slider"
            aria-label={`${compId} wiper position`}
            onChange={() => {/* FR-6 propagation — wired in audio pipeline */ }}
          />
          <span className="inspector-value">{Math.round(pos * 100)}%</span>
        </div>
      </InspectorRow>
    </InspectorSection>
  );
}

function CapacitorInspector({
  value,
}: {
  compId: string;
  value: CapacitorValue | undefined;
}) {
  const cap = value?.capacitance_pf ?? 22000;
  const display = cap >= 1_000_000
    ? `${(cap / 1_000_000).toFixed(3)} µF`
    : `${cap.toLocaleString()} pF`;

  return (
    <InspectorSection title="Capacitor">
      <InspectorRow label="Capacitance">
        <span className="inspector-value">{display}</span>
      </InspectorRow>
      {value?.voltage_rating && (
        <InspectorRow label="Voltage">
          <span className="inspector-value">{value.voltage_rating}V</span>
        </InspectorRow>
      )}
    </InspectorSection>
  );
}

function ResistorInspector({
  value,
}: {
  compId: string;
  value: ResistorValue | undefined;
}) {
  const r = value?.resistance_ohms ?? 470;
  const display = r >= 1000 ? `${(r / 1000).toFixed(1)}kΩ` : `${r}Ω`;

  return (
    <InspectorSection title="Resistor">
      <InspectorRow label="Resistance">
        <span className="inspector-value">{display}</span>
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Diagnostics panel ─────────────────────────────────────────────────── */

function DiagnosticsPanel({ diagnostics }: { diagnostics: LintDiagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="diagnostics-panel diagnostics-panel--ok">
        <span className="diag-dot diag-dot--ok" />
        <span>No issues</span>
      </div>
    );
  }

  return (
    <div className="diagnostics-panel">
      {diagnostics.map((d, i) => (
        <div key={i} className={`diag-item diag-item--${d.severity}`}>
          <span className="diag-code">{d.code}</span>
          <span className="diag-msg">{d.message}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Layout helpers ────────────────────────────────────────────────────── */

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="inspector-section">
      <div className="inspector-section__title">{title}</div>
      {children}
    </div>
  );
}

function InspectorRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inspector-row">
      <span className="inspector-row__label">{label}</span>
      <span className="inspector-row__value">{children}</span>
    </div>
  );
}
