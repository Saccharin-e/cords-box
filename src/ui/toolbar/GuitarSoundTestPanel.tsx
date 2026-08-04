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
  const [sampleBankReady, setSampleBankReady] = useState(audioPipeline.isSampleBankReady());

  // Dragging State
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);

  const toggleTestPanel = useCanvasStore((s) => s.toggleTestPanel);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const solverResult = useCircuitStore((s) => s.solverResult);
  const activePathCount = solverResult?.activePaths.length ?? 0;
  const isCircuitConnected = activePathCount > 0;

  function handlePointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).tagName === 'BUTTON' || (e.target as HTMLElement).tagName === 'SELECT') return;

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    setPos({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (isDragging) {
      setIsDragging(false);
      dragStartRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignored
      }
    }
  }

  // Check audio status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioActive(audioEngine.isReady());
      setAutoStrumming(audioPipeline.isAutoStrumming());
      setDemoSongPlaying(audioPipeline.isDemoSongPlaying());
      setSampleBankReady(audioPipeline.isSampleBankReady());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Waveform canvas animation loop
  useEffect(() => {
    if (!audioActive) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(128);

    function draw() {
      if (!ctx || !canvas) return;
      audioPipeline.getWaveformData(dataArray);

      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines background
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Waveform plot
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = isCircuitConnected ? '#d97706' : '#71717a';
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [audioActive, isCircuitConnected]);

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
      className="guitar-sound-panel neu-panel"
      id="guitar-sound-test-panel"
      style={{
        padding: '12px 14px',
        backgroundColor: '#18181b',
        border: '1px solid #27272a',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: 360,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        boxShadow: isDragging ? '0 16px 48px rgba(0,0,0,0.8)' : '0 8px 32px rgba(0,0,0,0.6)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {/* Draggable Header & Status Indicator */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          paddingBottom: 6,
          borderBottom: '1px solid #27272a',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#71717a', fontSize: 13, letterSpacing: -1, fontWeight: 700 }}>
            ⋮⋮
          </span>
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

      {/* Audio Engine Sound Source Status */}
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
              color: sampleBankReady ? '#38bdf8' : '#fbbf24',
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
            <span>{sampleBankReady ? 'Real Clean Electric Guitar (CDN Samples)' : 'Loading Real Guitar Samples...'}</span>
          </span>
        </div>
      </div>

      {/* Live Oscilloscope Waveform Canvas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Audio Waveform
          </span>
          <span style={{ fontSize: 10, color: audioActive ? '#a3e635' : '#71717a' }}>
            {audioActive ? 'DSP Active' : 'DSP Idle'}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={340}
          height={48}
          style={{
            width: '100%',
            height: 48,
            backgroundColor: '#0a0a0c',
            borderRadius: 6,
            border: '1px solid #27272a',
          }}
        />
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
