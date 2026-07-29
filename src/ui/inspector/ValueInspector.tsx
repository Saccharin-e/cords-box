/**
 * ValueInspector — DIYLC-Style Comprehensive Component & Wire Property Inspector.
 *
 * Provides extensive physical, electrical, and aesthetic customization for every component and wire:
 * - Identity: Label rename, X/Y coordinates, Quick Rotation, Flip H/V
 * - Pickups: Resistance (DCR), Magnet type, Finish/Cover style, Conductor spec
 * - Switches: Interactive Position Selector, Model type, Tip finish
 * - Potentiometers: Resistance, Taper (Audio/Linear/RevAudio), Smooth 0-100% position slider
 * - Capacitors: Capacitance, Voltage rating, Construction style (Orange Drop, Paper-in-Oil, Ceramic)
 * - Resistors: Resistance value, Power rating, Live 4-Band Color Code Visualizer
 * - Output Jack: Jack style, Plate finish
 * - Wires: Wire color palette, Insulation type (Vintage Cloth/Vinyl/Shielded), Connection type, Resistance
 * - Real-time Wiring Diagnostics & Linter feedback
 */

import { useState, useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { lintCircuit } from '@lint/linter';
import type { LintDiagnostic } from '@lint/linter';
import type { PotentiometerValue, CapacitorValue, ResistorValue, CircuitEdge } from '@graph/types';
import { buildWireVisuals } from '@ui/canvas/wireUtils';

export function ValueInspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const instances = useCanvasStore((s) => s.instances);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const toggleInspector = useCanvasStore((s) => s.toggleInspector);

  const rotateSelected = useCanvasStore((s) => s.rotateSelected);
  const flipSelectedH = useCanvasStore((s) => s.flipSelectedH);
  const flipSelectedV = useCanvasStore((s) => s.flipSelectedV);
  const moveInstance = useCanvasStore((s) => s.moveInstance);
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const bringForward = useCanvasStore((s) => s.bringForward);
  const sendBackward = useCanvasStore((s) => s.sendBackward);

  const graph = useCircuitStore((s) => s.graph);
  const selectedEdgeId = useCircuitStore((s) => s.selectedEdgeId);
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const updateComponentLabel = useCircuitStore((s) => s.updateComponentLabel);
  const updateEdge = useCircuitStore((s) => s.updateEdge);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const selectEdge = useCircuitStore((s) => s.selectEdge);
  const removeInstance = useCanvasStore((s) => s.removeInstance);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const removeComponent = useCircuitStore((s) => s.removeComponent);

  const diagnostics = lintCircuit(graph);

  const inst = instances.find((i) => i.id === selectedId);
  const component = inst ? graph.getComponent(inst.id) : undefined;
  const edge = selectedEdgeId ? graph.getEdge(selectedEdgeId) : undefined;

  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    if (component) {
      setLabelInput(component.label || inst?.label || '');
    }
  }, [component, inst]);

  function handleLabelBlur() {
    if (component && labelInput.trim()) {
      updateComponentLabel(component.id, labelInput.trim());
      updateInstance(component.id, { label: labelInput.trim() });
    }
  }

  function handleDeleteComponent() {
    if (!selectedId) return;
    removeInstance(selectedId);
    removeComponent(selectedId);
    selectInstance(null);
  }

  function handleDeleteWire() {
    if (!selectedEdgeId) return;
    removeEdge(selectedEdgeId);
    selectEdge(null);
  }

  if (!isInspectorOpen) return null;

  return (
    <aside className="inspector neu-panel" id="inspector-panel">
      <div
        className="inspector__header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span className="inspector__title">Inspector</span>
        <button onClick={toggleInspector} style={closeButtonStyle} title="Close Inspector Panel">
          ✕
        </button>
      </div>

      <div style={{ padding: '0 var(--space-4)', flex: 1, overflowY: 'auto' }}>
        {/* Wire / Edge Inspector when wire is selected */}
        {edge ? (
          <WireInspector edge={edge} onUpdate={updateEdge} onDelete={handleDeleteWire} />
        ) : component && inst ? (
          <>
            {/* General Identity & CAD Transform Section */}
            <InspectorSection title="Identity & Position">
              <InspectorRow label="ID">
                <span className="inspector-mono">{component.id}</span>
              </InspectorRow>
              <InspectorRow label="Type">
                <span className="inspector-mono" style={{ textTransform: 'capitalize' }}>
                  {component.type.replace(/_/g, ' ')}
                </span>
              </InspectorRow>
              <InspectorRow label="Label">
                <input
                  type="text"
                  className="inspector-input"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onBlur={handleLabelBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleLabelBlur()}
                  placeholder="Component Label"
                />
              </InspectorRow>

              {/* Transform / Coordinates */}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>X:</span>
                    <input
                      type="number"
                      className="inspector-input"
                      value={Math.round(inst.x)}
                      onChange={(e) => moveInstance(inst.id, Number(e.target.value), inst.y)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Y:</span>
                    <input
                      type="number"
                      className="inspector-input"
                      value={Math.round(inst.y)}
                      onChange={(e) => moveInstance(inst.id, inst.x, Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Rotation & Flip Controls */}
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    className="btn btn--sm"
                    onClick={() => rotateSelected(90)}
                    title="Rotate 90° CW"
                    style={{ flex: 1, padding: '4px' }}
                  >
                    ↻ 90°
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={flipSelectedH}
                    title="Flip Horizontal"
                    style={{ flex: 1, padding: '4px' }}
                  >
                    ⇄ Flip H
                  </button>
                  <button
                    className="btn btn--sm"
                    onClick={flipSelectedV}
                    title="Flip Vertical"
                    style={{ flex: 1, padding: '4px' }}
                  >
                    ⇅ Flip V
                  </button>
                </div>
              </div>
            </InspectorSection>

            {/* Type-Specific DIYLC Customizations */}
            {(component.type === 'pickup_single_coil' || component.type === 'pickup_humbucker') && (
              <PickupInspector compId={component.id} type={component.type} />
            )}

            {(component.type === 'switch_3way' ||
              component.type === 'switch_4way' ||
              component.type === 'switch_5way' ||
              component.type === 'switch_dpdt') && (
              <SwitchInspector compId={component.id} type={component.type} />
            )}

            {(component.type === 'pot_volume' ||
              component.type === 'pot_tone' ||
              component.type === 'pot_blend' ||
              component.type === 'pot_concentric') && (
              <PotentiometerInspector
                compId={component.id}
                value={component.value as PotentiometerValue | undefined}
                onUpdate={(val) => updateComponentValue(component.id, val)}
              />
            )}

            {component.type === 'capacitor' && (
              <CapacitorInspector
                value={component.value as CapacitorValue | undefined}
                onUpdate={(val) => updateComponentValue(component.id, val)}
              />
            )}

            {component.type === 'resistor' && (
              <ResistorInspector
                value={component.value as ResistorValue | undefined}
                onUpdate={(val) => updateComponentValue(component.id, val)}
              />
            )}

            {component.type === 'output_jack' && <OutputJackInspector />}

            {/* Layering Controls */}
            <div
              style={{
                marginTop: 14,
                marginBottom: 12,
                borderTop: '1px solid #27272a',
                paddingTop: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#71717a',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Layering
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <button
                  className="btn btn--secondary"
                  style={{ fontSize: 10, padding: '4px 6px' }}
                  onClick={() => bringToFront(component.id)}
                >
                  Bring to Front
                </button>
                <button
                  className="btn btn--secondary"
                  style={{ fontSize: 10, padding: '4px 6px' }}
                  onClick={() => sendToBack(component.id)}
                >
                  Send to Back
                </button>
                <button
                  className="btn btn--secondary"
                  style={{ fontSize: 10, padding: '4px 6px' }}
                  onClick={() => bringForward(component.id)}
                >
                  Bring Forward
                </button>
                <button
                  className="btn btn--secondary"
                  style={{ fontSize: 10, padding: '4px 6px' }}
                  onClick={() => sendBackward(component.id)}
                >
                  Send Backward
                </button>
              </div>
            </div>

            {/* Delete Component Button */}
            <div style={{ marginTop: 12, marginBottom: 16 }}>
              <button
                className="btn btn--primary"
                style={{
                  width: '100%',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                }}
                onClick={handleDeleteComponent}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete Component
                </span>
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              padding: 'var(--space-4)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-sm)',
              textAlign: 'center',
            }}
          >
            Select any component or wire on the canvas to customize its physical & electrical specs.
          </div>
        )}
      </div>

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
            ✓ Circuit verified — no defect warnings.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 110,
              overflowY: 'auto',
            }}
          >
            {diagnostics.map((d, i) => (
              <DiagnosticItem key={i} diagnostic={d} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─── Helper UI Components ────────────────────────────────────────────────── */

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
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

/* ─── Pickup Customization ────────────────────────────────────────────────── */

function PickupInspector({ compId: _compId, type }: { compId: string; type: string }) {
  const [dcr, setDcr] = useState(type === 'pickup_sc' ? '6.5' : '8.5');
  const [magnet, setMagnet] = useState('Alnico V');
  const [finish, setFinish] = useState('Cream');
  const [conductor, setConductor] = useState(type === 'pickup_sc' ? '2-Conductor' : '4-Conductor');

  return (
    <InspectorSection title="Pickup Specifications">
      <InspectorRow label="DC Resistance">
        <select className="inspector-select" value={dcr} onChange={(e) => setDcr(e.target.value)}>
          <option value="5.8">5.8 kΩ (Vintage Strat)</option>
          <option value="6.5">6.5 kΩ (Telecaster Bridge)</option>
          <option value="7.5">7.5 kΩ (P-90 Soapbar)</option>
          <option value="8.5">8.5 kΩ (PAF Humbucker)</option>
          <option value="12.0">12.0 kΩ (Hot Overwound)</option>
          <option value="14.5">14.5 kΩ (Ceramic High Output)</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Magnet Type">
        <select
          className="inspector-select"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
        >
          <option value="Alnico II">Alnico II (Warm/Smooth)</option>
          <option value="Alnico III">Alnico III (Low Output)</option>
          <option value="Alnico V">Alnico V (Punchy/Bright)</option>
          <option value="Ceramic">Ceramic (Tight/Aggressive)</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Cover Finish">
        <select
          className="inspector-select"
          value={finish}
          onChange={(e) => setFinish(e.target.value)}
        >
          <option value="Cream">Vintage Cream</option>
          <option value="Aged White">Aged White</option>
          <option value="Black">Gloss Black</option>
          <option value="Nickel">Chrome / Nickel</option>
          <option value="Gold">Gold Plate</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Coil Wiring">
        <select
          className="inspector-select"
          value={conductor}
          onChange={(e) => setConductor(e.target.value)}
        >
          <option value="2-Conductor">2-Conductor Vintage</option>
          <option value="4-Conductor">4-Conductor (Split / Series)</option>
        </select>
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Switch Customization ────────────────────────────────────────────────── */

function SwitchInspector({ compId, type }: { compId: string; type: string }) {
  const graph = useCircuitStore((s) => s.graph);
  const setSwitchState = useCircuitStore((s) => s.setSwitchState);

  const totalPos =
    type === 'switch_3way' ? 3 : type === 'switch_4way' ? 4 : type === 'switch_5way' ? 5 : 2;

  const currentSwState = graph.getSwitchState(compId);
  const currentPos = currentSwState?.currentPosition ?? 1;

  function handlePosClick(pos: number) {
    setSwitchState({
      componentId: compId,
      currentPosition: pos,
      totalPositions: totalPos,
      poles: type === 'switch_dpdt' ? 2 : type === 'switch_3way' ? 1 : 2,
    });
  }

  return (
    <InspectorSection title="Switch Controls">
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            marginBottom: 6,

            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Active Position:</span>
          <span className="inspector-mono" style={{ color: 'var(--color-accent-blue)' }}>
            Position {currentPos}
          </span>
        </div>

        {/* Position Selector Buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalPos }, (_, i) => i + 1).map((pos) => (
            <button
              key={pos}
              className={`btn btn--sm ${currentPos === pos ? 'btn--primary' : ''}`}
              style={{
                flex: 1,
                padding: '4px 0',
                backgroundColor: currentPos === pos ? 'var(--color-accent-blue)' : undefined,
                color: currentPos === pos ? '#000' : undefined,
              }}
              onClick={() => handlePosClick(pos)}
            >
              P{pos}
            </button>
          ))}
        </div>
      </div>

      <InspectorRow label="Switch Spec">
        <span className="inspector-mono">
          {type === 'switch_3way'
            ? '1-Pole 3-Way Toggle'
            : type === 'switch_4way'
              ? '2-Pole 4-Way Blade'
              : type === 'switch_5way'
                ? '2-Pole 5-Way Blade'
                : 'DPDT Push-Pull'}
        </span>
      </InspectorRow>

      <InspectorRow label="Tip Style">
        <select className="inspector-select" defaultValue="Amber">
          <option value="Amber">Amber / Cream</option>
          <option value="Black">Black Barrel</option>
          <option value="White">White Strat Tip</option>
          <option value="Chrome">Chrome Metal</option>
        </select>
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Potentiometer Customization ─────────────────────────────────────────── */

function PotentiometerInspector({
  value,
  onUpdate,
}: {
  compId: string;
  value?: PotentiometerValue;
  onUpdate: (val: PotentiometerValue) => void;
}) {
  const resistance = value?.resistance_kohms ?? 250;
  const taper = value?.taper ?? 'audio';
  const position = value?.position ?? 1.0;

  return (
    <InspectorSection title="Potentiometer Settings">
      <InspectorRow label="Resistance">
        <select
          className="inspector-select"
          value={resistance}
          onChange={(e) => onUpdate({ resistance_kohms: Number(e.target.value), taper, position })}
        >
          <option value={250}>250 kΩ (Single Coil Standard)</option>
          <option value={500}>500 kΩ (Humbucker Standard)</option>
          <option value={1000}>1 MΩ (Bright/Jazzmaster)</option>
          <option value={25}>25 kΩ (Active Pickups)</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Taper Curve">
        <select
          className="inspector-select"
          value={taper}
          onChange={(e) =>
            onUpdate({
              resistance_kohms: resistance,
              taper: e.target.value as PotentiometerValue['taper'],
              position,
            })
          }
        >
          <option value="audio">Audio (Logarithmic A)</option>
          <option value="linear">Linear (B)</option>
          <option value="reverse_audio">Reverse Audio (C)</option>
        </select>
      </InspectorRow>

      {/* Knob Position Slider */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span style={{ color: 'var(--color-text-secondary)' }}>Knob Shaft Rotation</span>
          <span className="inspector-mono" style={{ color: 'var(--color-accent-amber)' }}>
            {Math.round(position * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={position}
          onChange={(e) =>
            onUpdate({
              resistance_kohms: resistance,
              taper,
              position: parseFloat(e.target.value),
            })
          }
          style={{ width: '100%', accentColor: 'var(--color-accent-amber)' }}
        />
      </div>
    </InspectorSection>
  );
}

/* ─── Capacitor Customization ─────────────────────────────────────────────── */

function CapacitorInspector({
  value,
  onUpdate,
}: {
  value?: CapacitorValue;
  onUpdate: (val: CapacitorValue) => void;
}) {
  const capacitance = value?.capacitance_pf ?? 47000;
  const [style, setStyle] = useState('Orange Drop');

  return (
    <InspectorSection title="Capacitor Specifications">
      <InspectorRow label="Capacitance">
        <select
          className="inspector-select"
          value={capacitance}
          onChange={(e) =>
            onUpdate({ capacitance_pf: Number(e.target.value), voltage_rating: 400 })
          }
        >
          <option value={47000}>0.047 µF (Fender Spec)</option>
          <option value={22000}>0.022 µF (Gibson Spec)</option>
          <option value={33000}>0.033 µF (Warm Balance)</option>
          <option value={1000}>0.001 µF (Treble Bleed)</option>
          <option value={100000}>0.100 µF (Dark Warm)</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Cap Style">
        <select
          className="inspector-select"
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          <option value="Orange Drop">Orange Drop (Polyfilm)</option>
          <option value="Paper in Oil">Paper in Oil (PIO Vintage)</option>
          <option value="Ceramic Disc">Ceramic Disc</option>
          <option value="Mylar Film">Mylar Film</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Voltage Rating">
        <span className="inspector-mono">400V</span>
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Resistor Customization & Live Color Bands ────────────────────────────── */

function ResistorInspector({
  value,
  onUpdate,
}: {
  value?: ResistorValue;
  onUpdate: (val: ResistorValue) => void;
}) {
  const resistance = value?.resistance_ohms ?? 150000;

  return (
    <InspectorSection title="Resistor Specifications">
      <InspectorRow label="Resistance">
        <select
          className="inspector-select"
          value={resistance}
          onChange={(e) => onUpdate({ resistance_ohms: Number(e.target.value) })}
        >
          <option value={150000}>150 kΩ (Treble Bleed Load)</option>
          <option value="220000">220 kΩ (Grid Resistor)</option>
          <option value={470000}>470 kΩ (Coil Split Resistor)</option>
          <option value={1000000}>1 MΩ (High-Z Isolation)</option>
        </select>
      </InspectorRow>

      {/* Color Code Band Visualizer */}
      <div style={{ marginTop: 8, padding: 8, background: '#121215', borderRadius: 6 }}>
        <div style={{ fontSize: 10, color: '#a1a1aa', marginBottom: 4 }}>
          4-Band Resistor Color Code:
        </div>
        <ResistorBands resistance={resistance} />
      </div>
    </InspectorSection>
  );
}

function ResistorBands({ resistance }: { resistance: number }) {
  const bands = getResistorColorBands(resistance);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {bands.map((color, idx) => (
        <div
          key={idx}
          style={{
            flex: 1,
            height: 12,
            backgroundColor: color,
            borderRadius: 2,
            border: '1px solid rgba(0,0,0,0.5)',
          }}
          title={`Band ${idx + 1}: ${color}`}
        />
      ))}
    </div>
  );
}

function getResistorColorBands(ohms: number): string[] {
  const colorMap: Record<number, string> = {
    0: '#000000', // Black
    1: '#8b4513', // Brown
    2: '#ef4444', // Red
    3: '#f97316', // Orange
    4: '#eab308', // Yellow
    5: '#22c55e', // Green
    6: '#3b82f6', // Blue
    7: '#a855f7', // Violet
    8: '#6b7280', // Grey
    9: '#ffffff', // White
  };

  const str = ohms.toString();
  const d1 = Number(str[0] || '1');
  const d2 = Number(str[1] || '0');
  const zeros = str.length - 2;

  const multiplierMap: Record<number, string> = {
    0: '#000000',
    1: '#8b4513',
    2: '#ef4444',
    3: '#f97316',
    4: '#eab308',
    5: '#22c55e',
    6: '#3b82f6',
  };

  return [
    colorMap[d1] || '#8b4513',
    colorMap[d2] || '#000000',
    multiplierMap[zeros] || '#eab308',
    '#ca8a04', // Gold (5%)
  ];
}

/* ─── Output Jack Customization ───────────────────────────────────────────── */

function OutputJackInspector() {
  const [jackStyle, setJackStyle] = useState('Mono Open Frame');
  const [plateFinish, setPlateFinish] = useState('Chrome');

  return (
    <InspectorSection title="Output Jack Specs">
      <InspectorRow label="Jack Style">
        <select
          className="inspector-select"
          value={jackStyle}
          onChange={(e) => setJackStyle(e.target.value)}
        >
          <option value="Mono Open Frame">1/4" Mono Open Frame</option>
          <option value="Stereo Barrel">1/4" Stereo Barrel (Active)</option>
          <option value="Pure Tone Multi-Contact">Pure Tone Multi-Contact</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Plate Finish">
        <select
          className="inspector-select"
          value={plateFinish}
          onChange={(e) => setPlateFinish(e.target.value)}
        >
          <option value="Chrome">Chrome Plate</option>
          <option value="Nickel">Nickel Vintage</option>
          <option value="Gold">Gold Plate</option>
          <option value="Black">Black Oxide</option>
        </select>
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Wire / Connection Customization ─────────────────────────────────────── */

function WireInspector({
  edge,
  onUpdate,
  onDelete,
}: {
  edge: CircuitEdge;
  onUpdate: (id: string, updates: Partial<CircuitEdge>) => void;
  onDelete: () => void;
}) {
  const PRESET_COLORS = [
    { name: 'White Hot', color: '#ffffff' },
    { name: 'Black GND', color: '#18181b' },
    { name: 'Red Hot', color: '#ef4444' },
    { name: 'Yellow', color: '#eab308' },
    { name: 'Green', color: '#22c55e' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Bare Shield', color: '#a1a1aa' },
  ];

  return (
    <InspectorSection title="Wire Connection Specs">
      <InspectorRow label="Wire ID">
        <span className="inspector-mono">{edge.id}</span>
      </InspectorRow>

      <InspectorRow label="Terminals">
        <span className="inspector-mono" style={{ fontSize: 10 }}>
          {edge.source} ➔ {edge.target}
        </span>
      </InspectorRow>

      {/* Wire Color Palette */}
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
          Wire Color Insulation:
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESET_COLORS.map((p) => (
            <button
              key={p.color}
              onClick={() => onUpdate(edge.id, { wireColor: p.color })}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: p.color,
                border:
                  edge.wireColor === p.color
                    ? '2px solid var(--color-accent-amber)'
                    : '1px solid #3f3f46',
                cursor: 'pointer',
              }}
              title={p.name}
            />
          ))}
          <input
            type="color"
            value={edge.wireColor || '#888888'}
            onChange={(e) => onUpdate(edge.id, { wireColor: e.target.value })}
            style={{
              width: 20,
              height: 20,
              padding: 0,
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              background: 'none',
            }}
            title="Custom Hex Color"
          />
        </div>
      </div>

      <InspectorRow label="Points">
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4].map((num) => {
            const currentCount = edge.controlPoints ? edge.controlPoints.length : 1;
            return (
              <button
                key={num}
                onClick={() => {
                  const currentGraph = useCircuitStore.getState().graph;
                  const currentInstances = useCanvasStore.getState().instances;
                  const wireVisuals = buildWireVisuals(
                    () => currentGraph.getEdges(),
                    currentInstances,
                    new Set(),
                  );
                  const vis = wireVisuals.find((w) => w.id === edge.id);
                  const x1 = vis?.x1 ?? 100;
                  const y1 = vis?.y1 ?? 100;
                  const x2 = vis?.x2 ?? 300;
                  const y2 = vis?.y2 ?? 300;

                  if (num === 1) {
                    const midX = Math.round((x1 + x2) / 2);
                    const midY = Math.round((y1 + y2) / 2);
                    onUpdate(edge.id, {
                      controlPoint: { x: midX, y: midY },
                      controlPoints: undefined,
                    });
                  } else {
                    const pts = Array.from({ length: num }).map((_, idx) => {
                      const t = (idx + 1) / (num + 1);
                      return {
                        x: Math.round(x1 + (x2 - x1) * t),
                        y: Math.round(y1 + (y2 - y1) * t),
                      };
                    });
                    onUpdate(edge.id, { controlPoints: pts, controlPoint: undefined });
                  }
                }}
                className="btn btn--sm"
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  backgroundColor: currentCount === num ? '#d97706' : '#27272a',
                  color: currentCount === num ? '#18181b' : '#a1a1aa',
                  border: '1px solid #3f3f46',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontWeight: currentCount === num ? 700 : 500,
                }}
              >
                {num} {num === 1 ? 'Pt' : 'Pts'}
              </button>
            );
          })}
        </div>
      </InspectorRow>

      <InspectorRow label="Wire Type">
        <select
          className="inspector-select"
          value={edge.wireType}
          onChange={(e) =>
            onUpdate(edge.id, { wireType: e.target.value as CircuitEdge['wireType'] })
          }
        >
          <option value="vintage_cloth_pushback">Vintage Cloth Pushback</option>
          <option value="modern_vinyl">Modern Vinyl Insulated</option>
          <option value="shielded">Shielded Coaxial</option>
          <option value="bare">Bare Lead</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Joint Type">
        <select
          className="inspector-select"
          value={edge.connectionType}
          onChange={(e) =>
            onUpdate(edge.id, { connectionType: e.target.value as CircuitEdge['connectionType'] })
          }
        >
          <option value="solder">Solder Joint</option>
          <option value="quick_connect">Quick-Connect Terminal</option>
          <option value="crimp">Crimp Terminal</option>
          <option value="twist">Twist Join</option>
        </select>
      </InspectorRow>

      <InspectorRow label="Resistance">
        <span className="inspector-mono">{edge.resistance || 0} Ω</span>
      </InspectorRow>

      <div style={{ marginTop: 14 }}>
        <button
          className="btn btn--primary"
          style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
          onClick={onDelete}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Wire
          </span>
        </button>
      </div>
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
      <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{diagnostic.message}</div>
    </div>
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
