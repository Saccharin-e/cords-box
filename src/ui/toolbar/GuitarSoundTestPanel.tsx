/**
 * GuitarSoundTestPanel.tsx — Interactive Guitar Audio Sound Testing Bench UI
 *
 * Real-time guitar sound test bench providing string pluck triggers, chord strums,
 * automated strumming loop, live waveform oscilloscope visualizer, and preset selector.
 */

import { useState, useEffect, useRef } from 'react';
import {
  audioEngine,
  audioPipeline,
  GUITAR_STRINGS,
  GUITAR_CHORDS,
  GUITAR_DEMO_GENRES,
  type GuitarDemoGenre,
} from '@audio/index';
import { useCircuitStore } from '@store/circuitStore';
import { useCanvasStore } from '@store/canvasStore';
import { PRESETS, loadPresetById, type PresetDefinition } from '@presets/presetLibrary';

export function GuitarSoundTestPanel() {
  const [audioActive, setAudioActive] = useState(false);
  const [autoStrumming, setAutoStrumming] = useState(false);
  const [demoSongPlaying, setDemoSongPlaying] = useState(false);
  const [selectedDemoGenre, setSelectedDemoGenre] = useState<GuitarDemoGenre>('rock');
  const [selectedPresetId, setSelectedPresetId] = useState('guitar_sound_test_template');
  const [volumeBoost, setVolumeBoost] = useState<number>(audioPipeline.getMasterVolumeBoost());
  const [usingSamples, setUsingSamples] = useState<boolean>(audioPipeline.isUsingSamples());
  const [isSpectrumExpanded, setIsSpectrumExpanded] = useState(false);

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

  const toggleTestPanel = useCanvasStore((s) => s.toggleTestPanel);

  const solverResult = useCircuitStore((s) => s.solverResult);
  const activePathCount = solverResult?.activePaths.length ?? 0;
  const isCircuitConnected = activePathCount > 0;

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

  // Subscribe to audio engine state changes instead of polling.
  useEffect(() => {
    const update = () => {
      setAudioActive(audioEngine.isReady());
      setAutoStrumming(audioPipeline.isAutoStrumming());
      setDemoSongPlaying(audioPipeline.isDemoSongPlaying());
      setVolumeBoost(audioPipeline.getMasterVolumeBoost());
      setUsingSamples(audioPipeline.isUsingSamples());
    };
    update();
    const unsubscribeEngine = audioEngine.subscribe(update);
    const unsubscribePipeline = audioPipeline.subscribe(update);
    return () => {
      unsubscribeEngine();
      unsubscribePipeline();
    };
  }, []);

  function handleVolumeBoostChange(newVal: number) {
    setVolumeBoost(newVal);
    audioPipeline.setMasterVolumeBoost(newVal);
  }

  function handleToggleSoundSource() {
    const nextMode = !usingSamples;
    setUsingSamples(nextMode);
    audioPipeline.setUseSamples(nextMode);
  }

  async function ensureAudioReady() {
    if (!audioEngine.isReady()) {
      await audioEngine.initialize();
      await audioEngine.resume();
      setAudioActive(true);
      useCircuitStore.getState().solve();
    }
  }

  async function handlePluck(freq: number) {
    await ensureAudioReady();
    await audioPipeline.triggerPluck(freq);
  }

  async function handleStrum(freqs: readonly number[]) {
    await ensureAudioReady();
    audioPipeline.triggerStrum(freqs);
  }

  async function handleToggleAutoStrum() {
    await ensureAudioReady();
    const nextState = audioPipeline.toggleAutoStrum();
    setAutoStrumming(nextState);
  }

  async function handleGenreShowcase() {
    await ensureAudioReady();
    if (audioPipeline.isDemoSongPlaying()) {
      audioPipeline.stopDemoSong();
      setDemoSongPlaying(false);
      return;
    }

    const nextState = audioPipeline.playGenreDemo(selectedDemoGenre);
    setDemoSongPlaying(nextState);
    setAutoStrumming(false);
  }

  function handleSelectPreset(presetId: string) {
    setSelectedPresetId(presetId);
    loadPresetById(presetId);
  }

  return (
    <div
      style={{
        display: 'flex',
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        boxShadow: isDragging ? '0 16px 48px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.6)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        borderRadius: 8,
      }}
    >
      <div
        className="guitar-sound-panel neu-panel"
        id="guitar-sound-test-panel"
        style={{
          padding: '12px 14px',
          backgroundColor: '#18181b',
          border: '1px solid #27272a',
          borderRadius: isSpectrumExpanded ? '8px 0 0 8px' : 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: 360,
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
      {/* Draggable Header & Status Indicator */}
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
        title="Click and drag header to move guitar sound test bench panel"
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
              backgroundColor: isCircuitConnected ? '#a3e635' : '#ef4444',
              boxShadow: isCircuitConnected ? '0 0 6px #a3e635' : 'none',
            }}
          />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#f4f4f5' }}>
            Guitar Audio Test Bench
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setIsSpectrumExpanded(!isSpectrumExpanded)}
            style={{
              background: isSpectrumExpanded ? '#14532d' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 4,
              color: isSpectrumExpanded ? '#86efac' : '#a1a1aa',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            title="Toggle expanded FFT spectrum visualizer"
          >
            📊 {isSpectrumExpanded ? 'Spectrum On' : 'Spectrum'}
          </button>
          <span
            style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              backgroundColor: isCircuitConnected ? '#14532d' : '#450a0a',
              color: isCircuitConnected ? '#86efac' : '#fca5a5',
              fontWeight: 600,
            }}
          >
            {isCircuitConnected ? `${activePathCount} Path Active` : 'Circuit Open'}
          </span>
          <button
            onClick={toggleTestPanel}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              fontSize: 14,
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 4,
              lineHeight: 1,
            }}
            title="Close Panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Preset Selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>Load Test Circuit Preset:</label>
        <select
          value={selectedPresetId}
          onChange={(e) => handleSelectPreset(e.target.value)}
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
          {PRESETS.map((p: PresetDefinition) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Audio Engine Sound Source Status & Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 8px',
          backgroundColor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#a1a1aa', fontWeight: 600 }}>Audio Sound Source:</span>
          <span
            style={{
              fontSize: 11,
              color: audioPipeline.isUsingSamples() ? '#38bdf8' : '#a3e635',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>
              {usingSamples
                ? 'Real DI Electric Guitar (Local WAV Pack)'
                : 'Pure WASM/WDF Physical String Synth'}
            </span>
          </span>
        </div>
        <button
          onClick={handleToggleSoundSource}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 4,
            border: '1px solid #3f3f46',
            backgroundColor: usingSamples ? '#102a35' : '#14532d',
            color: usingSamples ? '#38bdf8' : '#a3e635',
            cursor: 'pointer',
          }}
        >
          {usingSamples ? 'Switch to WDF Synth' : 'Switch to Local WAV'}
        </button>
      </div>

      {/* Master Volume Booster Control */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 10px',
          backgroundColor: '#121215',
          border: '1px solid #d97706',
          borderRadius: 6,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔊 Master Volume Boost
          </span>
          <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 800 }}>
            {Math.round(volumeBoost * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3.5"
          step="0.1"
          value={volumeBoost}
          onChange={(e) => handleVolumeBoostChange(Number(e.target.value))}
          style={{
            width: '100%',
            cursor: 'pointer',
            accentColor: '#d97706',
          }}
          title="Adjust overall master output volume boost"
        />
        <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
          {[1.0, 1.5, 2.0, 3.0].map((b) => (
            <button
              key={b}
              onClick={() => handleVolumeBoostChange(b)}
              style={{
                flex: 1,
                padding: '2px 0',
                fontSize: 10,
                fontWeight: 700,
                backgroundColor: volumeBoost === b ? '#b45309' : '#27272a',
                color: volumeBoost === b ? '#fff' : '#a1a1aa',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {Math.round(b * 100)}%
            </button>
          ))}
        </div>
      </div>



      {/* String Plucks (E2 - E4) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>Guitar String Plucks:</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {Object.entries(GUITAR_STRINGS).map(([name, freq]) => (
            <button
              key={name}
              onClick={() => handlePluck(Number(freq))}
              className="btn btn--sm"
              style={{
                padding: '4px 0',
                fontSize: 11,
                fontWeight: 700,
                backgroundColor: '#27272a',
                color: '#f4f4f5',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                cursor: 'pointer',
                textAlign: 'center',
              }}
              title={`Pluck ${name} (${freq} Hz)`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Chord Strums */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>Strum Guitar Chords:</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleStrum(GUITAR_CHORDS.E_MAJOR)}
            style={btnChordStyle}
          >
            E Maj
          </button>
          <button
            onClick={() => handleStrum(GUITAR_CHORDS.A_MINOR)}
            style={btnChordStyle}
          >
            Am
          </button>
          <button
            onClick={() => handleStrum(GUITAR_CHORDS.G_MAJOR)}
            style={btnChordStyle}
          >
            G Maj
          </button>
          <button
            onClick={() => handleStrum(GUITAR_CHORDS.D_MAJOR)}
            style={btnChordStyle}
          >
            D Maj
          </button>
          <button
            onClick={() => handleStrum(GUITAR_CHORDS.E5_POWER)}
            style={btnChordStyle}
          >
            E5 Power
          </button>
        </div>
      </div>

      {/* Auto Strum Loop Button */}
      <button
        onClick={handleToggleAutoStrum}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 12,
          border: '1px solid',
          borderColor: autoStrumming ? '#d97706' : '#3f3f46',
          backgroundColor: autoStrumming ? '#78350f' : '#27272a',
          color: autoStrumming ? '#fef3c7' : '#f4f4f5',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
        }}
      >
        <span>{autoStrumming ? '⏸ Stop Auto-Strum Loop' : '▶ Start Continuous Strumming Loop'}</span>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }} htmlFor="guitar-demo-genre">
          Song-style Demo Genre:
        </label>
        <select
          id="guitar-demo-genre"
          value={selectedDemoGenre}
          onChange={(event) => setSelectedDemoGenre(event.target.value as GuitarDemoGenre)}
          disabled={demoSongPlaying}
          style={{
            padding: '6px 8px',
            backgroundColor: '#09090b',
            color: '#f4f4f5',
            border: '1px solid #3f3f46',
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          {GUITAR_DEMO_GENRES.map((genre) => (
            <option key={genre.id} value={genre.id}>
              {genre.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleGenreShowcase}
        style={{
          width: '100%',
          padding: '8px',
          borderRadius: 6,
          fontWeight: 700,
          fontSize: 12,
          border: '1px solid #0e7490',
          backgroundColor: demoSongPlaying ? '#083344' : '#102a35',
          color: '#cffafe',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
          {demoSongPlaying ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              <span>Stop Song Demo</span>
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Play Song Demo</span>
            </>
          )}
        </button>
      </div>

      {/* Expandable Comprehensive Spectrum Visualizer */}
      {isSpectrumExpanded && (
        <div
          style={{
            width: 480,
            backgroundColor: '#09090b',
            border: '1px solid #27272a',
            borderLeft: 'none',
            borderRadius: '0 8px 8px 0',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#f4f4f5', fontWeight: 700 }}>
              Live FFT Spectrum Analysis
            </span>
            <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600 }}>128-Band EQ Visualizer</span>
          </div>
          <ComprehensiveSpectrumVisualizer isActive={audioActive} />
        </div>
      )}
    </div>
  );
}

// Sub-component for the comprehensive spectrum visualizer
function ComprehensiveSpectrumVisualizer({ isActive }: { isActive: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!isActive) return;

    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioPipeline.getAnalyserNode();
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Arrays for peak hold
    const numBars = 128;
    const peaks = new Array(numBars).fill(0);
    const peakDrops = new Array(numBars).fill(0);

    const render = () => {
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background grid
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for(let y=1; y<=4; y++) {
        ctx.moveTo(0, height * (y/5));
        ctx.lineTo(width, height * (y/5));
      }
      for(let x=1; x<=5; x++) {
        ctx.moveTo(width * (x/6), 0);
        ctx.lineTo(width * (x/6), height);
      }
      ctx.stroke();

      const barWidth = (width - numBars) / numBars;
      const step = Math.floor(bufferLength / numBars);

      for (let i = 0; i < numBars; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        let avg = sum / step;
        
        // Enhance low frequencies visually to match human hearing better
        if (i < 20) avg *= 1.2;
        
        const barHeight = (Math.min(255, avg) / 255) * height;
        const x = i * (barWidth + 1);
        const y = height - barHeight;
        
        // Update peaks
        if (barHeight > peaks[i]) {
          peaks[i] = barHeight;
          peakDrops[i] = 0;
        } else {
          peakDrops[i] += 0.5;
          peaks[i] = Math.max(0, peaks[i] - peakDrops[i]);
        }

        // Draw Peak
        if (peaks[i] > 0) {
          ctx.fillStyle = '#f4f4f5';
          ctx.fillRect(x, height - peaks[i] - 2, barWidth, 2);
        }

        // Draw Bar
        const hue = 220 - (i / numBars) * 120; // Blue to Green to Yellow
        const gradient = ctx.createLinearGradient(0, height, 0, y);
        gradient.addColorStop(0, `hsla(${hue}, 80%, 40%, 0.4)`);
        gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 1.0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <canvas 
        ref={canvasRef} 
        width={440} 
        height={220} 
        style={{ 
          width: '100%', 
          height: '220px',
          border: '1px solid #27272a',
          borderRadius: 4
        }} 
      />
      
      {/* X-Axis Frequency Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 2px 0 2px', color: '#71717a', fontSize: 10, fontWeight: 600 }}>
        <span>60Hz</span>
        <span>250Hz</span>
        <span>1kHz</span>
        <span>4kHz</span>
        <span>10kHz</span>
      </div>
    </div>
  );
}

const btnChordStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 4px',
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: '#1f1f23',
  color: '#e4e4e7',
  border: '1px solid #3f3f46',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'center',
};
