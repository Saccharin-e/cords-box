/**
 * AmpPedalboardPanel.tsx — Customizable Amp Simulator & Stompbox Pedalboard UI
 *
 * Provides real-time interactive controls for:
 * - Tube Amp Head Models: Clean Twin, Crunch 800, High Gain Lead, Vox Chime
 * - Stompbox Pedals: Compressor, Overdrive/Distortion, Chorus, Delay, Reverb
 * - Speaker Cabinets & Mic Placement
 */

import { useState, useRef, useEffect } from 'react';
import {
  audioPipeline,
  type AmpPedalboardState,
  type AmpModelType,
  type CabinetModelType,
  type DriveType,
} from '@audio/pipeline';
import { useCanvasStore } from '@store/canvasStore';

export function AmpPedalboardPanel() {
  const toggleAmpPanel = useCanvasStore((s) => s.toggleAmpPanel);
  const [activeTab, setActiveTab] = useState<'amp' | 'pedals' | 'cabinet'>('amp');

  // Amp & Pedalboard State
  const [state, setState] = useState<AmpPedalboardState>(() => audioPipeline.getAmpPedalboardState());

  // Dragging State (Global Window Listeners)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(e: PointerEvent) {
      if (!dragStartRef.current) return;
      const scale = useCanvasStore.getState().scale || 1;
      const dx = (e.clientX - dragStartRef.current.pointerX) / scale;
      const dy = (e.clientY - dragStartRef.current.pointerY) / scale;
      setPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    }

    function handlePointerUp() {
      setIsDragging(false);
      dragStartRef.current = null;
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging]);

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('a')) return;

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  }

  function updateState(updates: Partial<AmpPedalboardState>) {
    const nextState = { ...state, ...updates };
    setState(nextState);
    audioPipeline.updateAmpPedalboardState(nextState);
  }

  return (
    <div
      className="amp-pedalboard-panel neu-panel"
      id="amp-pedalboard-panel"
      style={{
        padding: '12px 14px',
        backgroundColor: '#141417',
        border: '1px solid #27272a',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: 380,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        boxShadow: isDragging ? '0 16px 48px rgba(0,0,0,0.85)' : '0 8px 32px rgba(0,0,0,0.7)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          paddingBottom: 6,
          borderBottom: '1px solid #27272a',
          userSelect: 'none',
        }}
        title="Click and drag header to move amp pedalboard panel"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Drag Handle Grip Icon */}
          <div style={{ display: 'flex', alignItems: 'center', cursor: isDragging ? 'grabbing' : 'grab' }}>
            <svg width="12" height="16" viewBox="0 0 12 16" fill="none" style={{ opacity: 0.5, marginRight: 2 }}>
              <circle cx="3" cy="3" r="1.5" fill="#a1a1aa" />
              <circle cx="9" cy="3" r="1.5" fill="#a1a1aa" />
              <circle cx="3" cy="8" r="1.5" fill="#a1a1aa" />
              <circle cx="9" cy="8" r="1.5" fill="#a1a1aa" />
              <circle cx="3" cy="13" r="1.5" fill="#a1a1aa" />
              <circle cx="9" cy="13" r="1.5" fill="#a1a1aa" />
            </svg>
          </div>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 6px #38bdf8',
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#f4f4f5' }}>
            Amp Simulator & Pedalboard
          </span>
        </div>

        <button
          onClick={toggleAmpPanel}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            fontSize: 14,
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 4,
          }}
          title="Close Panel"
        >
          ✕
        </button>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: 'flex', gap: 4, backgroundColor: '#09090b', padding: 3, borderRadius: 6 }}>
        <button
          onClick={() => setActiveTab('amp')}
          style={{
            flex: 1,
            padding: '5px 0',
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: activeTab === 'amp' ? '#27272a' : 'transparent',
            color: activeTab === 'amp' ? '#fbbf24' : '#a1a1aa',
            border: 'none',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span>Amp Head</span>
        </button>
        <button
          onClick={() => setActiveTab('pedals')}
          style={{
            flex: 1,
            padding: '5px 0',
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: activeTab === 'pedals' ? '#27272a' : 'transparent',
            color: activeTab === 'pedals' ? '#38bdf8' : '#a1a1aa',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <circle cx="15" cy="9" r="2" />
            <rect x="8" y="14" width="8" height="3" rx="1" />
          </svg>
          <span>Pedalboard</span>
        </button>
        <button
          onClick={() => setActiveTab('cabinet')}
          style={{
            flex: 1,
            padding: '5px 0',
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: activeTab === 'cabinet' ? '#27272a' : 'transparent',
            color: activeTab === 'cabinet' ? '#a3e635' : '#a1a1aa',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="12" r="4" />
            <line x1="6" y1="6" x2="6" y2="6.01" />
            <line x1="18" y1="6" x2="18" y2="6.01" />
          </svg>
          <span>Cabinet & Mic</span>
        </button>
      </div>

      {/* Tab Content 1: Amp Head */}
      {activeTab === 'amp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Amp Model Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>Amp Architecture Model:</label>
            <select
              value={state.ampModel}
              onChange={(e) => updateState({ ampModel: e.target.value as AmpModelType })}
              style={{
                padding: '6px 8px',
                backgroundColor: '#09090b',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="clean_twin">Fender Twin Reverb (American Clean)</option>
              <option value="crunch_800">Marshall JCM800 (British Crunch)</option>
              <option value="high_gain">Mesa/Boogie Dual Rectifier (Modern Lead)</option>
              <option value="vox_chime">Vox AC30 (Chime Class-A)</option>
            </select>
          </div>

          {/* Tone Stack Knobs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <KnobControl
              label="Preamp Gain"
              value={state.ampGain}
              onChange={(v) => updateState({ ampGain: v })}
              color="#fbbf24"
            />
            <KnobControl
              label="Bass EQ"
              value={state.ampBass}
              onChange={(v) => updateState({ ampBass: v })}
            />
            <KnobControl
              label="Middle EQ"
              value={state.ampMid}
              onChange={(v) => updateState({ ampMid: v })}
            />
            <KnobControl
              label="Treble EQ"
              value={state.ampTreble}
              onChange={(v) => updateState({ ampTreble: v })}
            />
            <KnobControl
              label="Presence"
              value={state.ampPresence}
              onChange={(v) => updateState({ ampPresence: v })}
            />
            <KnobControl
              label="Master Vol"
              value={state.ampMaster}
              onChange={(v) => updateState({ ampMaster: v })}
              color="#ef4444"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090b', padding: '6px 10px', borderRadius: 6, border: '1px solid #27272a' }}>
            <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Speaker Volume Boost (+0..+12dB):</span>
            <input
              type="range"
              min="0.8"
              max="3.5"
              step="0.1"
              defaultValue={audioPipeline.getMasterVolumeBoost()}
              onChange={(e) => audioPipeline.setMasterVolumeBoost(Number(e.target.value))}
              style={{ width: 120, cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {/* Tab Content 2: Stompbox Pedalboard */}
      {activeTab === 'pedals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
          {/* Compressor Pedal */}
          <PedalCard
            title="Dyna Compressor"
            color="#38bdf8"
            enabled={state.compressorEnabled}
            onToggle={() => updateState({ compressorEnabled: !state.compressorEnabled })}
          >
            <KnobControl
              label="Sustain"
              value={state.compressorSustain}
              onChange={(v) => updateState({ compressorSustain: v })}
            />
            <KnobControl
              label="Output Level"
              value={state.compressorLevel}
              onChange={(v) => updateState({ compressorLevel: v })}
            />
          </PedalCard>

          {/* Overdrive Pedal */}
          <PedalCard
            title="Drive & Distortion Pedal"
            color="#f59e0b"
            enabled={state.overdriveEnabled}
            onToggle={() => updateState({ overdriveEnabled: !state.overdriveEnabled })}
          >
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#a1a1aa' }}>Type:</span>
              <select
                value={state.overdriveType}
                onChange={(e) => updateState({ overdriveType: e.target.value as DriveType })}
                style={{
                  flex: 1,
                  padding: '3px 6px',
                  backgroundColor: '#09090b',
                  color: '#f4f4f5',
                  border: '1px solid #3f3f46',
                  borderRadius: 4,
                  fontSize: 10,
                }}
              >
                <option value="overdrive">Transparent Overdrive</option>
                <option value="tube_screamer">TS9 Tube Screamer</option>
                <option value="distortion">Heavy Metal Distortion</option>
              </select>
            </div>
            <KnobControl
              label="Drive"
              value={state.overdriveDrive}
              onChange={(v) => updateState({ overdriveDrive: v })}
              color="#f59e0b"
            />
            <KnobControl
              label="Tone Filter"
              value={state.overdriveTone}
              onChange={(v) => updateState({ overdriveTone: v })}
            />
            <KnobControl
              label="Pedal Level"
              value={state.overdriveLevel}
              onChange={(v) => updateState({ overdriveLevel: v })}
            />
          </PedalCard>

          {/* Chorus Pedal */}
          <PedalCard
            title="Stereo Chorus Modulation"
            color="#a855f7"
            enabled={state.chorusEnabled}
            onToggle={() => updateState({ chorusEnabled: !state.chorusEnabled })}
          >
            <KnobControl
              label="Rate (Hz)"
              value={(state.chorusRate - 0.1) / 4.9}
              onChange={(v) => updateState({ chorusRate: 0.1 + v * 4.9 })}
            />
            <KnobControl
              label="Depth"
              value={state.chorusDepth}
              onChange={(v) => updateState({ chorusDepth: v })}
            />
            <KnobControl
              label="Wet Mix"
              value={state.chorusMix}
              onChange={(v) => updateState({ chorusMix: v })}
              color="#a855f7"
            />
          </PedalCard>

          {/* Delay Pedal */}
          <PedalCard
            title="Tape Echo Delay"
            color="#10b981"
            enabled={state.delayEnabled}
            onToggle={() => updateState({ delayEnabled: !state.delayEnabled })}
          >
            <KnobControl
              label={`Time (${Math.round(state.delayTimeMs)}ms)`}
              value={(state.delayTimeMs - 50) / 750}
              onChange={(v) => updateState({ delayTimeMs: 50 + v * 750 })}
            />
            <KnobControl
              label="Feedback"
              value={state.delayFeedback / 0.85}
              onChange={(v) => updateState({ delayFeedback: v * 0.85 })}
            />
            <KnobControl
              label="Echo Mix"
              value={state.delayMix}
              onChange={(v) => updateState({ delayMix: v })}
              color="#10b981"
            />
          </PedalCard>

          {/* Reverb Pedal */}
          <PedalCard
            title="3D Room Reverb"
            color="#ec4899"
            enabled={state.reverbEnabled}
            onToggle={() => updateState({ reverbEnabled: !state.reverbEnabled })}
          >
            <KnobControl
              label="Room Size"
              value={state.reverbSize}
              onChange={(v) => updateState({ reverbSize: v })}
            />
            <KnobControl
              label="Decay Time"
              value={state.reverbDecay}
              onChange={(v) => updateState({ reverbDecay: v })}
            />
            <KnobControl
              label="Reverb Mix"
              value={state.reverbMix}
              onChange={(v) => updateState({ reverbMix: v })}
              color="#ec4899"
            />
          </PedalCard>
        </div>
      )}

      {/* Tab Content 3: Cabinet & Mic */}
      {activeTab === 'cabinet' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>Speaker Cabinet Impulse Model:</label>
            <select
              value={state.cabModel}
              onChange={(e) => updateState({ cabModel: e.target.value as CabinetModelType })}
              style={{
                padding: '6px 8px',
                backgroundColor: '#09090b',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="1x12_open">1x12 Open Back Combo (Jensen Blue)</option>
              <option value="2x12_tweed">2x12 Vintage Tweed (Celestion Cream)</option>
              <option value="4x12_stack">4x12 British Half Stack (Celestion V30)</option>
              <option value="4x12_metal">4x12 Metal Beast (Custom Tight Scoop)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', backgroundColor: '#09090b', borderRadius: 6, border: '1px solid #27272a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>
              <span>Microphone Position / Distance:</span>
              <span style={{ color: '#a3e635' }}>{Math.round(state.micDistance * 100)}% Off-Cap</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={state.micDistance}
              onChange={(e) => updateState({ micDistance: parseFloat(e.target.value) })}
              style={{ accentColor: '#a3e635', cursor: 'pointer' }}
            />
          </div>

          {/* Signal Chain: Cable Length & Amp Input Impedance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', backgroundColor: '#09090b', borderRadius: 6, border: '1px solid #27272a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>
              <span>Cable Length:</span>
              <span style={{ color: '#f59e0b' }}>{state.cableLengthMeters}m ({Math.round(state.cableLengthMeters * 100)}pF)</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={state.cableLengthMeters}
              onChange={(e) => updateState({ cableLengthMeters: parseFloat(e.target.value) })}
              style={{ accentColor: '#f59e0b', cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', backgroundColor: '#09090b', borderRadius: 6, border: '1px solid #27272a' }}>
            <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600, marginBottom: 4 }}>Amp Input Impedance:</div>
            <select
              value={state.ampInputImpedanceOhms}
              onChange={(e) => updateState({ ampInputImpedanceOhms: parseInt(e.target.value) })}
              style={{
                backgroundColor: '#18181b',
                color: '#e4e4e7',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value={1000000}>1MΩ — Passive (Standard)</option>
              <option value={47000}>47kΩ — Vintage</option>
              <option value={10000}>10kΩ — Active Pickups</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Knob Slider Component
function KnobControl({
  label,
  value,
  onChange,
  color = '#38bdf8',
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  color?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '6px 4px',
        backgroundColor: '#09090b',
        borderRadius: 6,
        border: '1px solid #27272a',
      }}
    >
      <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 600, textAlign: 'center' }}>
        {label}
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 10, color, fontWeight: 700 }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// Reusable Pedal Card Component
function PedalCard({
  title,
  color,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  color: string;
  enabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        backgroundColor: '#09090b',
        borderRadius: 6,
        border: `1px solid ${enabled ? color : '#27272a'}`,
        transition: 'border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: enabled ? color : '#3f3f46',
              boxShadow: enabled ? `0 0 6px ${color}` : 'none',
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: enabled ? '#f4f4f5' : '#71717a' }}>
            {title}
          </span>
        </div>
        <button
          onClick={onToggle}
          style={{
            padding: '2px 8px',
            fontSize: 10,
            fontWeight: 700,
            backgroundColor: enabled ? color : '#27272a',
            color: enabled ? '#000000' : '#a1a1aa',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {enabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {enabled && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}
