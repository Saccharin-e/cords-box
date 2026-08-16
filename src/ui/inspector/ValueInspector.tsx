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

import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { buildWireVisuals } from '../canvas/wireUtils';
import { getShape } from '../canvas/shapes';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import type { PotentiometerValue, CapacitorValue, ResistorValue, CircuitEdge } from '@graph/types';
import { ArrowRight, Lock, Unlock, X } from 'lucide-react';

export function ValueInspector() {
  const selectedId = useCanvasStore((s) => s.selectedId);
  const instances = useCanvasStore((s) => s.instances);
  const isInspectorOpen = useCanvasStore((s) => s.isInspectorOpen);
  const toggleInspector = useCanvasStore((s) => s.toggleInspector);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const rotateSelected = useCanvasStore((s) => s.rotateSelected);
  const flipSelectedH = useCanvasStore((s) => s.flipSelectedH);
  const flipSelectedV = useCanvasStore((s) => s.flipSelectedV);
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const bringForward = useCanvasStore((s) => s.bringForward);
  const sendBackward = useCanvasStore((s) => s.sendBackward);

  const graph = useCircuitStore((s) => s.graph);
  useCircuitStore((s) => s.version);
  const selectedEdgeId = useCircuitStore((s) => s.selectedEdgeId);
  const updateComponentValue = useCircuitStore((s) => s.updateComponentValue);
  const updateComponentLabel = useCircuitStore((s) => s.updateComponentLabel);
  const updateEdge = useCircuitStore((s) => s.updateEdge);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const selectEdge = useCircuitStore((s) => s.selectEdge);
  const removeInstance = useCanvasStore((s) => s.removeInstance);
  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const removeComponent = useCircuitStore((s) => s.removeComponent);

  const inst = instances.find((i) => i.id === selectedId);
  const isLocked = inst?.isLocked ?? false;
  const toggleLock = () => {
    if (inst) updateInstance(inst.id, { isLocked: !isLocked });
  };
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
      updateInstance(component.id, { label: labelInput.trim() }, true);
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
    <div
      style={{
        backgroundColor: '#121318',
        border: '1px solid #27272a',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        flex: isCollapsed ? '0 0 auto' : 1,
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* VS Code Accordion Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          backgroundColor: '#18181b',
          borderBottom: isCollapsed ? 'none' : '1px solid #27272a',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f4f4f5' }}>
            Property Inspector
          </span>
          {component && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                backgroundColor: '#0284c7',
                color: '#e0f2fe',
                maxWidth: 130,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {component.label || component.type}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#71717a' }}>{isCollapsed ? '▲' : '▼'}</span>
          <Button
            variant="icon"
            aria-label="Close Inspector Sidebar"
            onClick={(e) => {
              e.stopPropagation();
              toggleInspector();
            }}
            style={{
              color: '#a1a1aa',
              fontSize: 14,
            }}
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div style={{ padding: '8px 10px', flex: 1, overflowY: 'auto' }}>
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

                {/* Transform & Order Actions */}
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#71717a',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    CAD Actions & Orientation
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <Button
                      className="btn--sm"
                      onClick={() => rotateSelected(90)}
                      title="Rotate 90° Clockwise"
                      style={{ flex: 1, padding: '4px' }}
                    >
                      ↻ Rotate 90°
                    </Button>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button
                      className="btn--sm"
                      onClick={flipSelectedH}
                      title="Flip Horizontal"
                      style={{ flex: 1, padding: '4px' }}
                    >
                      ⇄ Flip H
                    </Button>
                    <Button
                      className="btn--sm"
                      onClick={flipSelectedV}
                      title="Flip Vertical"
                      style={{ flex: 1, padding: '4px' }}
                    >
                      ⇅ Flip V
                    </Button>
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
                component.type === 'switch_dpdt' ||
                component.type === 'pot_pushpull') && (
                <SwitchInspector compId={component.id} type={component.type} />
              )}

              {(component.type === 'pot_volume' ||
                component.type === 'pot_tone' ||
                component.type === 'pot_blend' ||
                component.type === 'pot_concentric' ||
                component.type === 'pot_pushpull') && (
                <PotentiometerInspector
                  compId={component.id}
                  value={component.value as PotentiometerValue | undefined}
                  onUpdate={(val) => updateComponentValue(component.id, val, true)}
                  onCommit={pushHistory}
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

              {component.type === 'text_box' && <TextBoxInspector inst={inst} />}

              {component.type === 'project_card' && <ProjectCardInspector inst={inst} />}

              {(component.type === 'shape_rect' ||
                component.type === 'shape_circle' ||
                component.type === 'shape_line' ||
                component.type === 'shape_arrow' ||
                component.type === 'text_box') && <FreeShapeInspector inst={inst} />}

              {/* Editable Custom Labels, Finish Colors & Terminal Lugs Inspector */}
              {component.type !== 'text_box' &&
                component.type !== 'project_card' &&
                !component.type.startsWith('shape_') && <CustomLabelsAndLugsInspector inst={inst} />}

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
                  <Button
                    variant="secondary"
                    style={{ fontSize: 10, padding: '4px 6px' }}
                    onClick={() => bringToFront(component.id)}
                  >
                    Bring to Front
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={toggleLock}
                    style={{ padding: '2px 4px', fontSize: 10 }}
                    title={isLocked ? 'Unlock component' : 'Lock component'}
                  >
                    {isLocked ? (
                      <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <Lock size={14} /> Locked
                      </span>
                    ) : (
                      <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <Unlock size={14} /> Unlocked
                      </span>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    style={{ fontSize: 10, padding: '4px 6px' }}
                    onClick={() => bringForward(component.id)}
                  >
                    Bring Forward
                  </Button>
                  <Button
                    variant="secondary"
                    style={{ fontSize: 10, padding: '4px 6px' }}
                    onClick={() => sendBackward(component.id)}
                  >
                    Send Backward
                  </Button>
                </div>
              </div>

              {/* Delete Component Button */}
              <div style={{ marginTop: 12, marginBottom: 16 }}>
                <Button
                  variant="primary"
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
                </Button>
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
      )}
    </div>
  );
}

/* ─── Helper UI Components ────────────────────────────────────────────────── */

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
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
  useCircuitStore((s) => s.version);
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

  const isPushPull = type === 'pot_pushpull';

  return (
    <InspectorSection title={isPushPull ? 'Push-Pull DPDT Switch' : 'Switch Controls'}>
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
            {isPushPull
              ? currentPos === 1
                ? 'Pushed (Normal)'
                : 'Pulled (Phase Flip)'
              : `Position ${currentPos}`}
          </span>
        </div>

        {/* Position Selector Buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalPos }, (_, i) => i + 1).map((pos) => (
            <Button
              key={pos}
              className={`btn--sm ${currentPos === pos ? 'btn--primary' : ''}`}
              style={{
                flex: 1,
                padding: '4px 0',
                backgroundColor: currentPos === pos ? 'var(--color-accent-blue)' : undefined,
                color: currentPos === pos ? '#000' : undefined,
              }}
              onClick={() => handlePosClick(pos)}
            >
              {isPushPull ? (pos === 1 ? 'Pushed' : 'Pulled') : `P${pos}`}
            </Button>
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
  onCommit,
}: {
  compId: string;
  value?: PotentiometerValue;
  onUpdate: (val: PotentiometerValue) => void;
  onCommit: () => void;
}) {
  const resistance = value?.resistance_kohms ?? 250;
  const taper = value?.taper ?? 'audio';
  const position = value?.position ?? 1.0;

  const [localPos, setLocalPos] = useState(position);
  const rafRef = useRef<number | null>(null);
  const latestPosRef = useRef(position);

  useEffect(() => {
    setLocalPos(position);
  }, [position]);

  function handleSliderChange(val: number) {
    setLocalPos(val);
    latestPosRef.current = val;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      onUpdate({
        resistance_kohms: resistance,
        taper,
        position: latestPosRef.current,
      });
    });
  }

  function handleSliderCommit() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onUpdate({
      resistance_kohms: resistance,
      taper,
      position: latestPosRef.current,
    });
    onCommit();
  }

  function handleSelectChange(next: Partial<PotentiometerValue>) {
    onUpdate({ resistance_kohms: resistance, taper, position: localPos, ...next });
    onCommit();
  }

  return (
    <InspectorSection title="Potentiometer Settings">
      <InspectorRow label="Resistance">
        <select
          className="inspector-select"
          value={resistance}
          onChange={(e) => handleSelectChange({ resistance_kohms: Number(e.target.value) })}
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
            handleSelectChange({ taper: e.target.value as PotentiometerValue['taper'] })
          }
        >
          <option value="audio">Audio (Logarithmic A)</option>
          <option value="linear">Linear (B)</option>
          <option value="reverse_audio">Reverse Audio (C)</option>
        </select>
      </InspectorRow>

      {/* Knob Position Slider */}
      <Slider
        label="Knob Shaft Rotation"
        value={localPos}
        min={0}
        max={1}
        step={0.01}
        unit="%"
        accentColor="var(--color-accent-amber)"
        onChange={handleSliderChange}
        onCommit={handleSliderCommit}
      />
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
          {edge.source} <ArrowRight size={14} /> {edge.target}
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



/* ─── Custom Lug Labels & Color Theme Inspector ──────────────────────────── */
function CustomLabelsAndLugsInspector({ inst }: { inst: any }) {
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const shape = getShape(inst.type);

  return (
    <InspectorSection title="Custom Labels & Lug Names">
      <InspectorRow label="Display Title">
        <input
          type="text"
          className="inspector-input"
          value={inst.customLabel ?? inst.label ?? ''}
          onChange={(e) => updateInstance(inst.id, { customLabel: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder={shape.label}
        />
      </InspectorRow>

      {/* Pickup Finish Theme */}
      {(inst.type === 'pickup_single_coil' || inst.type === 'pickup_p90' || inst.type === 'pickup_humbucker') && (
        <InspectorRow label="Finish Style">
          <select
            className="inspector-select"
            value={inst.colorTheme ?? 'vintage'}
            onChange={(e) => updateInstance(inst.id, { colorTheme: e.target.value })}
          >
            <option value="vintage">Vintage Yellow / Amber</option>
            <option value="cream">Cream / Aged White</option>
            <option value="black">Black Cover / Bobbin</option>
          </select>
        </InspectorRow>
      )}

      {/* Terminal Lug Editors */}
      {shape.lugs.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', marginBottom: 6 }}>
            Terminal Lug Labels ({shape.lugs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {shape.lugs.map((lug: any) => {
              const currentVal = inst.customLugLabels?.[lug.id] ?? lug.label;
              return (
                <div key={lug.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: '#71717a', width: 60, flexShrink: 0, fontFamily: 'monospace' }}>
                    {lug.id}
                  </span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={currentVal}
                    onChange={(e) => {
                      const updated = { ...(inst.customLugLabels ?? {}), [lug.id]: e.target.value };
                      updateInstance(inst.id, { customLugLabels: updated }, true);
                    }}
                    onBlur={pushHistory}
                    style={{ flex: 1 }}
                    placeholder={lug.label}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </InspectorSection>
  );
}

/* ─── Text Box Inspector ─────────────────────────────────────────────────── */
function TextBoxInspector({ inst }: { inst: any }) {
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  return (
    <InspectorSection title="Text Box Notes">
      <InspectorRow label="Note Text">
        <textarea
          className="inspector-input"
          rows={4}
          value={inst.textValue ?? ''}
          onChange={(e) => updateInstance(inst.id, { textValue: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="Type notes, wiring instructions, or pinouts here..."
          style={{ width: '100%', fontFamily: 'sans-serif', resize: 'vertical' }}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Project Info Card Inspector ────────────────────────────────────────── */
function ProjectCardInspector({ inst }: { inst: any }) {
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  return (
    <InspectorSection title="Project Card Details">
      <InspectorRow label="Title">
        <input
          type="text"
          className="inspector-input"
          value={inst.customLabel ?? inst.label ?? ''}
          onChange={(e) => updateInstance(inst.id, { customLabel: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="GUITAR WIRING HARNESS"
        />
      </InspectorRow>
      <InspectorRow label="Author">
        <input
          type="text"
          className="inspector-input"
          value={inst.authorValue ?? ''}
          onChange={(e) => updateInstance(inst.id, { authorValue: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="Luthier Studio"
        />
      </InspectorRow>
      <InspectorRow label="Guitar Model">
        <input
          type="text"
          className="inspector-input"
          value={inst.modelValue ?? ''}
          onChange={(e) => updateInstance(inst.id, { modelValue: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="Stratocaster HSS / Telecaster"
        />
      </InspectorRow>
      <InspectorRow label="Date / Rev">
        <input
          type="text"
          className="inspector-input"
          value={inst.revisionValue ?? ''}
          onChange={(e) => updateInstance(inst.id, { revisionValue: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="2026-07-30 · Rev 1.0"
        />
      </InspectorRow>
      <InspectorRow label="Specs & Notes">
        <textarea
          className="inspector-input"
          rows={3}
          value={inst.textValue ?? ''}
          onChange={(e) => updateInstance(inst.id, { textValue: e.target.value }, true)}
          onBlur={pushHistory}
          placeholder="250K CTS Pots, 0.047uF Cap, Treble Bleed, 50s Wiring..."
          style={{ width: '100%', fontFamily: 'sans-serif', resize: 'vertical' }}
        />
      </InspectorRow>
    </InspectorSection>
  );
}

/* ─── Free Shape Styling & Dimensions Inspector ───────────────────────────── */
function FreeShapeInspector({ inst }: { inst: any }) {
  const updateInstance = useCanvasStore((s) => s.updateInstance);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const [localWidth, setLocalWidth] = useState(inst.strokeWidth ?? 2);
  const [localRadius, setLocalRadius] = useState(inst.cornerRadius ?? 6);

  useEffect(() => {
    setLocalWidth(inst.strokeWidth ?? 2);
  }, [inst.strokeWidth]);

  useEffect(() => {
    setLocalRadius(inst.cornerRadius ?? 6);
  }, [inst.cornerRadius]);

  return (
    <InspectorSection title="Shape Formatting & Appearance">
      {/* Width & Height Dimensions */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>W:</span>
          <input
            type="number"
            className="inspector-input"
            value={Math.round(inst.width)}
            onChange={(e) => updateInstance(inst.id, { width: Math.max(10, Number(e.target.value)) }, true)}
            onBlur={pushHistory}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>H:</span>
          <input
            type="number"
            className="inspector-input"
            value={Math.round(inst.height)}
            onChange={(e) => updateInstance(inst.id, { height: Math.max(10, Number(e.target.value)) }, true)}
            onBlur={pushHistory}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Stroke Color */}
      <InspectorRow label="Stroke Color">
        <select
          className="inspector-select"
          value={inst.strokeColor ?? (inst.type === 'shape_rect' ? '#a855f7' : '#38bdf8')}
          onChange={(e) => updateInstance(inst.id, { strokeColor: e.target.value })}
        >
          <option value="#a855f7">Purple (#a855f7)</option>
          <option value="#38bdf8">Cyan (#38bdf8)</option>
          <option value="#eab308">Yellow (#eab308)</option>
          <option value="#22c55e">Green (#22c55e)</option>
          <option value="#ef4444">Red (#ef4444)</option>
          <option value="#f8fafc">White (#f8fafc)</option>
          <option value="#64748b">Slate (#64748b)</option>
          <option value="#0f172a">Dark Navy (#0f172a)</option>
        </select>
      </InspectorRow>

      {/* Fill Color */}
      <InspectorRow label="Fill Color">
        <select
          className="inspector-select"
          value={inst.fillColor ?? 'transparent'}
          onChange={(e) => updateInstance(inst.id, { fillColor: e.target.value })}
        >
          <option value="transparent">None (Transparent)</option>
          <option value="rgba(168, 85, 247, 0.15)">Purple Tint (15%)</option>
          <option value="rgba(56, 189, 248, 0.15)">Cyan Tint (15%)</option>
          <option value="rgba(234, 179, 8, 0.15)">Yellow Tint (15%)</option>
          <option value="rgba(34, 197, 94, 0.15)">Green Tint (15%)</option>
          <option value="rgba(255, 255, 255, 0.08)">Subtle White Tint (8%)</option>
          <option value="#0f172a">Solid Navy Dark (#0f172a)</option>
        </select>
      </InspectorRow>

      {/* Stroke Width */}
      <Slider
        label="Line Weight"
        value={localWidth}
        min={1}
        max={10}
        step={0.5}
        unit="px"
        accentColor="#a855f7"
        onChange={(val) => {
          setLocalWidth(val);
          updateInstance(inst.id, { strokeWidth: val }, true);
        }}
        onCommit={pushHistory}
        containerStyle={{ marginTop: 12, marginBottom: 12 }}
      />

      {/* Dash Style */}
      <InspectorRow label="Line Style">
        <select
          className="inspector-select"
          value={inst.dashStyle ?? 'solid'}
          onChange={(e) => updateInstance(inst.id, { dashStyle: e.target.value as any })}
        >
          <option value="solid">Solid Line</option>
          <option value="dashed">Dashed (---)</option>
          <option value="dotted">Dotted (...) </option>
        </select>
      </InspectorRow>

      {/* Corner Radius for Rectangles / Notes */}
      {(inst.type === 'shape_rect' || inst.type === 'text_box') && (
        <Slider
          label="Corner Rounding"
          value={localRadius}
          min={0}
          max={30}
          step={1}
          unit="px"
          accentColor="#a855f7"
          onChange={(val) => {
            setLocalRadius(val);
            updateInstance(inst.id, { cornerRadius: val }, true);
          }}
          onCommit={pushHistory}
          containerStyle={{ marginTop: 12, marginBottom: 12 }}
        />
      )}
    </InspectorSection>
  );
}
