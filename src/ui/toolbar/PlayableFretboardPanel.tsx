/**
 * PlayableFretboardPanel.tsx — Real-Time Playable Guitar Fretboard
 *
 * Interactive 6-string 15-fret guitar neck simulation.
 * Features:
 * - Real-time pitch calculation for 6 strings (E2..E4) x 15 frets
 * - Web Audio DSP routing directly into pickup circuit & tube amp pipeline
 * - Visual string vibration feedback
 * - Interactive chord presets & single-click strumming
 * - Keyboard shortcuts for live playing (1-6 for open strings, A-K for frets)
 */

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useTuningStore, TUNING_PRESETS } from '@store/tuningStore';
import { audioEngine, audioPipeline } from '@audio/index';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';

export interface GuitarStringDef {
  index: number;
  name: string;
  openFreq: number;
  openMidi: number;
  thickness: number;
  isWound: boolean;
}

export const GUITAR_STRINGS: GuitarStringDef[] = [
  { index: 0, name: 'E4 (High E)', openFreq: 329.63, openMidi: 64, thickness: 1.0, isWound: false },
  { index: 1, name: 'B3',          openFreq: 246.94, openMidi: 59, thickness: 1.4, isWound: false },
  { index: 2, name: 'G3',          openFreq: 196.00, openMidi: 55, thickness: 1.8, isWound: false },
  { index: 3, name: 'D3',          openFreq: 146.83, openMidi: 50, thickness: 2.4, isWound: true },
  { index: 4, name: 'A2',          openFreq: 110.00, openMidi: 45, thickness: 3.0, isWound: true },
  { index: 5, name: 'E2 (Low E)',  openFreq: 82.41,  openMidi: 40, thickness: 3.8, isWound: true },
];

export const BASS_4_STRINGS: GuitarStringDef[] = [
  { index: 0, name: 'G2 (High G)', openFreq: 98.00, openMidi: 43, thickness: 2.0, isWound: true },
  { index: 1, name: 'D2',          openFreq: 73.42, openMidi: 38, thickness: 2.8, isWound: true },
  { index: 2, name: 'A1',          openFreq: 55.00, openMidi: 33, thickness: 3.8, isWound: true },
  { index: 3, name: 'E1 (Low E)',  openFreq: 41.20, openMidi: 28, thickness: 4.8, isWound: true },
];

export const BASS_5_STRINGS: GuitarStringDef[] = [
  { index: 0, name: 'G2 (High G)', openFreq: 98.00, openMidi: 43, thickness: 2.0, isWound: true },
  { index: 1, name: 'D2',          openFreq: 73.42, openMidi: 38, thickness: 2.8, isWound: true },
  { index: 2, name: 'A1',          openFreq: 55.00, openMidi: 33, thickness: 3.8, isWound: true },
  { index: 3, name: 'E1',          openFreq: 41.20, openMidi: 28, thickness: 4.8, isWound: true },
  { index: 4, name: 'B0 (Low B)',  openFreq: 30.87, openMidi: 23, thickness: 5.6, isWound: true },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = Math.floor(midi) % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function calcFretFrequency(openFreq: number, fret: number): number {
  return openFreq * Math.pow(2, fret / 12);
}

export function calcFretMidi(openMidi: number, fret: number): number {
  return openMidi + fret;
}

const NUM_FRETS = 15;

// Inlay marker frets
const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19];
const DOUBLE_DOT_FRETS = [12];

export interface ChordPreset {
  name: string;
  // Frets for strings 0..5 (High E down to Low E), null means muted / X
  frets: (number | null)[];
}

export const CHORD_PRESETS: ChordPreset[] = [
  { name: 'E Major', frets: [0, 0, 1, 2, 2, 0] },
  { name: 'A Major', frets: [0, 2, 2, 2, 0, null] },
  { name: 'C Major', frets: [0, 1, 0, 2, 3, null] },
  { name: 'G Major', frets: [3, 0, 0, 0, 2, 3] },
  { name: 'D Major', frets: [2, 3, 2, 0, null, null] },
  { name: 'E Minor', frets: [0, 0, 0, 2, 2, 0] },
  { name: 'A Minor', frets: [0, 1, 2, 2, 0, null] },
  { name: 'E5 Power', frets: [null, null, null, 2, 2, 0] },
];

interface FretCellProps {
  stringIdx: number;
  stringName: string;
  fret: number;
  freq: number;
  noteName: string;
  thickness: number;
  isWound: boolean;
  isVibrating: boolean;
  chordFret: number | null;
  isActivePlay: boolean;
  isHovered: boolean;
  onFretMouseDown: (stringIdx: number, fret: number) => void;
  onFretMouseEnter: (stringIdx: number, fret: number) => void;
  onFretMouseLeave: () => void;
}

const FretCell = memo(function FretCell({
  stringIdx,
  stringName,
  fret,
  freq,
  noteName,
  thickness,
  isWound,
  isVibrating,
  chordFret,
  isActivePlay,
  isHovered,
  onFretMouseDown,
  onFretMouseEnter,
  onFretMouseLeave,
}: FretCellProps) {
  const isFrettedByChord = chordFret === fret;
  const shortNoteName = noteName.replace(/\d/, '');

  return (
    <div
      onMouseDown={() => onFretMouseDown(stringIdx, fret)}
      onMouseEnter={() => onFretMouseEnter(stringIdx, fret)}
      onMouseLeave={onFretMouseLeave}
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
      title={`${stringName} Fret ${fret}: ${noteName} (${freq.toFixed(1)} Hz)`}
    >
      {/* Realistic 3D Metallic Guitar String */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: thickness,
          backgroundColor: isVibrating ? '#fbbf24' : isWound ? '#a1a1aa' : '#e4e4e7',
          backgroundImage: isVibrating
            ? 'linear-gradient(180deg, #fef08a 0%, #f59e0b 50%, #d97706 100%)'
            : isWound
            ? 'linear-gradient(180deg, #f4f4f5 0%, #a1a1aa 40%, #71717a 75%, #3f3f46 100%), repeating-linear-gradient(90deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 3px)'
            : 'linear-gradient(180deg, #ffffff 0%, #e4e4e7 45%, #a1a1aa 80%, #52525b 100%)',
          backgroundBlendMode: isWound ? 'overlay' : 'normal',
          boxShadow: isVibrating
            ? '0 0 10px #fbbf24, 0 0 16px #f59e0b, 0 3px 6px rgba(0,0,0,0.9)'
            : '0 3px 5px rgba(0, 0, 0, 0.95), 0 1px 2px rgba(0, 0, 0, 0.8)',
          borderRadius: thickness / 2,
          transform: isVibrating ? 'scaleY(2.2)' : 'none',
          transition: 'all 0.08s ease',
        }}
      />

      {/* Movable Hover Target Halo */}
      {isHovered && !isActivePlay && !isFrettedByChord && (
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid #38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.25)',
            boxShadow: '0 0 12px #38bdf8, 0 0 4px rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 800,
            color: '#e0f2fe',
            zIndex: 6,
            pointerEvents: 'none',
          }}
        >
          {shortNoteName}
        </div>
      )}

      {/* Pressed / Active Movable Finger Indicator Badge */}
      {(isFrettedByChord || isActivePlay) && (
        <div
          style={{
            width: isActivePlay ? 24 : 18,
            height: isActivePlay ? 24 : 18,
            borderRadius: '50%',
            backgroundColor: isActivePlay
              ? '#f59e0b'
              : isFrettedByChord
              ? '#0284c7'
              : '#3f3f46',
            backgroundImage: isActivePlay
              ? 'radial-gradient(circle at 35% 35%, #fef08a 0%, #f59e0b 60%, #b45309 100%)'
              : 'none',
            color: '#ffffff',
            fontSize: isActivePlay ? 10 : 9,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isActivePlay
              ? '0 0 14px #f59e0b, 0 0 6px rgba(0,0,0,0.8)'
              : '0 0 6px rgba(0,0,0,0.6)',
            border: isActivePlay ? '2px solid #fffbeb' : 'none',
            zIndex: isActivePlay ? 7 : 5,
          }}
        >
          {shortNoteName}
        </div>
      )}
    </div>
  );
});

export function PlayableFretboardPanel() {
  const toggleFretboard = useCanvasStore((s) => s.toggleFretboard);
  const [instrumentType, setInstrumentType] = useState<'guitar' | 'bass_4' | 'bass_5'>('guitar');

  const activeStrings = useMemo(() => {
    if (instrumentType === 'bass_4') return BASS_4_STRINGS;
    if (instrumentType === 'bass_5') return BASS_5_STRINGS;
    return GUITAR_STRINGS;
  }, [instrumentType]);

  const [activeFret, setActiveFret] = useState<{
    stringIdx: number;
    fret: number;
    noteName: string;
    freq: number;
  } | null>(null);

  const [vibratingStrings, setVibratingStrings] = useState<Record<number, boolean>>({});
  const [selectedChord, setSelectedChord] = useState<ChordPreset | null>(CHORD_PRESETS[0]);
  const [strumSpeed, setStrumSpeed] = useState<number>(30); // ms per string

  const [hoveredFret, setHoveredFret] = useState<{ stringIdx: number; fret: number } | null>(null);
  const isMouseDownRef = useRef(false);

  // Panel Dragging / Moveable State (Global Window Listeners)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('input') || target.closest('select') || target.closest('a')) {
        return;
      }
      setIsDragging(true);
      dragStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        posX: pos.x,
        posY: pos.y,
      };
    },
    [pos.x, pos.y]
  );

  // Global mouseup listener for drag sliding
  useEffect(() => {
    function handleMouseUp() {
      isMouseDownRef.current = false;
    }
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Dynamic per-string note lookup table
  const fretNoteTable = useMemo(() => {
    return activeStrings.map((stringDef) =>
      Array.from({ length: NUM_FRETS + 1 }, (_, fret) => {
        const freq = calcFretFrequency(stringDef.openFreq, fret);
        const midi = calcFretMidi(stringDef.openMidi, fret);
        return { freq, midi, noteName: midiToNoteName(midi) };
      }),
    );
  }, [activeStrings]);

  // Ensure AudioContext is initialized & active when plucking
  const triggerNote = useCallback(
    async (stringIdx: number, fret: number) => {
      const stringDef = activeStrings[stringIdx];
      if (!stringDef) return;

      const freq = calcFretFrequency(stringDef.openFreq, fret);
      const midi = calcFretMidi(stringDef.openMidi, fret);
      const noteName = midiToNoteName(midi);

      setActiveFret({ stringIdx, fret, noteName, freq });

      // Trigger string vibration visual animation
      setVibratingStrings((prev) => ({ ...prev, [stringIdx]: true }));
      setTimeout(() => {
        setVibratingStrings((prev) => ({ ...prev, [stringIdx]: false }));
      }, 500);

      // Trigger Web Audio pipeline
      let ctx = audioEngine.getContext();
      if (!ctx) {
        await audioEngine.initialize();
        await audioEngine.resume();
        ctx = audioEngine.getContext();
      } else if (ctx.state === 'suspended') {
        await audioEngine.resume();
      }

      await audioPipeline.triggerPluck(freq, 0.65, stringIdx);
    },
    []
  );

  // Strum a chord across all active fretted strings
  const strumChord = useCallback(
    async (chord: ChordPreset) => {
      setSelectedChord(chord);

      let ctx = audioEngine.getContext();
      if (!ctx) {
        await audioEngine.initialize();
        await audioEngine.resume();
        ctx = audioEngine.getContext();
      } else if (ctx.state === 'suspended') {
        await audioEngine.resume();
      }

      // Collect active notes from Low E (5) to High E (0) for natural down-strum
      const activeNotes: { stringIdx: number; fret: number }[] = [];
      for (let s = 5; s >= 0; s--) {
        const fret = chord.frets[s];
        if (fret !== null) {
          activeNotes.push({ stringIdx: s, fret });
        }
      }

      activeNotes.forEach(({ stringIdx, fret }, i) => {
        setTimeout(() => {
          void triggerNote(stringIdx, fret);
        }, i * strumSpeed);
      });
    },
    [triggerNote, strumSpeed]
  );

  // Stable cell handlers so FretCell memoization is not defeated by
  // inline closures recreated on every panel render.
  const handleFretMouseDown = useCallback(
    (stringIdx: number, fret: number) => {
      isMouseDownRef.current = true;
      void triggerNote(stringIdx, fret);
    },
    [triggerNote]
  );

  const handleFretMouseEnter = useCallback(
    (stringIdx: number, fret: number) => {
      setHoveredFret({ stringIdx, fret });
      if (isMouseDownRef.current) {
        void triggerNote(stringIdx, fret);
      }
    },
    [triggerNote]
  );

  const handleFretMouseLeave = useCallback(() => {
    setHoveredFret(null);
  }, []);

  // Keyboard accessibility / performance controls
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Keys 1..6 -> Open strings High E to Low E
      if (e.key >= '1' && e.key <= '6') {
        const stringIdx = parseInt(e.key, 10) - 1;
        const currentFret = selectedChord?.frets[stringIdx] ?? 0;
        void triggerNote(stringIdx, currentFret);
      } else if (e.key === ' ' || e.key === 'Enter') {
        // Space / Enter -> Strum currently selected chord
        e.preventDefault();
        if (selectedChord) {
          void strumChord(selectedChord);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerNote, strumChord, selectedChord]);

  const fretArray = useMemo(() => Array.from({ length: NUM_FRETS + 1 }, (_, i) => i), []);

  return (
    <div
      className="playable-fretboard-panel"
      style={{
        width: 860,
        backgroundColor: '#121318',
        borderRadius: 12,
        border: '1px solid #27272a',
        boxShadow: isDragging
          ? '0 30px 70px rgba(0, 0, 0, 0.85), 0 0 15px rgba(251, 191, 36, 0.4)'
          : '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 2px rgba(251, 191, 36, 0.2)',
        overflow: 'hidden',
        color: '#f4f4f5',
        fontFamily: 'Inter, system-ui, sans-serif',
        userSelect: 'none',
        transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px)`,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      }}
    >
      {/* Panel Header (Draggable) */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: isDragging ? '#202025' : '#18181b',
          borderBottom: '1px solid #27272a',
          cursor: isDragging ? 'grabbing' : 'grab',
          transition: 'background-color 0.15s ease',
        }}
        title="Click and drag header to move fretboard panel"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#78350f',
              border: '1px solid #d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fef3c7' }}>
              Playable Guitar Fretboard
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <select
                value={instrumentType}
                onChange={(e) => setInstrumentType(e.target.value as 'guitar' | 'bass_4' | 'bass_5')}
                style={{
                  backgroundColor: '#27272a',
                  color: '#38bdf8',
                  border: '1px solid #3b82f6',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 4px',
                  cursor: 'pointer',
                }}
              >
                <option value="guitar">6-String Guitar</option>
                <option value="bass_4">4-String Bass</option>
                <option value="bass_5">5-String Bass</option>
              </select>
              <select
                value={useTuningStore((s) => s.activeTuningId)}
                onChange={(e) => useTuningStore.getState().setTuning(e.target.value)}
                style={{
                  backgroundColor: '#27272a',
                  color: '#fbbf24',
                  border: '1px solid #71717a',
                  borderRadius: 4,
                  fontSize: 11,
                  padding: '1px 4px',
                  cursor: 'pointer',
                }}
              >
                {TUNING_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.description})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>
                &bull; Drag header to move &bull; Click frets or press 1-6 / Space
              </span>
            </div>
          </div>
        </div>

        {/* Note Status Badge & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {activeFret ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                backgroundColor: '#27272a',
                border: '1px solid #d97706',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#fbbf24',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800 }}>{activeFret.noteName}</span>
              <span style={{ color: '#a1a1aa', fontSize: 11 }}>
                ({activeFret.freq.toFixed(1)} Hz &bull; Fret {activeFret.fret})
              </span>
            </div>
          ) : (
            <div
              style={{
                padding: '4px 10px',
                backgroundColor: '#27272a',
                borderRadius: 6,
                fontSize: 11,
                color: '#71717a',
              }}
            >
              Ready to play
            </div>
          )}

          <Button
            variant="icon"
            aria-label="Close Fretboard"
            onClick={toggleFretboard}
            style={{
              color: '#a1a1aa',
              fontSize: 18,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Chord Preset Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          backgroundColor: '#0f0f12',
          borderBottom: '1px solid #27272a',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 600, marginRight: 4 }}>
            Chords:
          </span>
          {CHORD_PRESETS.map((chord) => {
            const isSelected = selectedChord?.name === chord.name;
            return (
              <Button
                key={chord.name}
                onClick={() => void strumChord(chord)}
                className="btn--sm"
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: isSelected ? '#d97706' : '#27272a',
                  color: isSelected ? '#ffffff' : '#e4e4e7',
                  border: isSelected ? '1px solid #f59e0b' : '1px solid #3f3f46',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                {chord.name}
              </Button>
            );
          })}
        </div>

        {/* Strum Speed Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Slider
            label="Strum Timing (ms)"
            value={strumSpeed}
            min={10}
            max={70}
            step={1}
            unit="raw"
            accentColor="#d97706"
            onChange={(val) => setStrumSpeed(val)}
            containerStyle={{ marginTop: 0, width: 120 }}
          />
        </div>
      </div>

      {/* Main Fretboard Graphic View */}
      <div
        style={{
          padding: '24px 20px',
          backgroundColor: '#1c130d',
          backgroundImage:
            'radial-gradient(ellipse at 50% 50%, #2a1c12 0%, #150d08 100%)',
          position: 'relative',
        }}
      >
        {/* Rosewood Guitar Neck Canvas */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#26170e',
            borderRadius: 6,
            boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.5)',
            border: '2px solid #3d2618',
            padding: '10px 0',
          }}
        >
          {/* Fret Numbers Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '50px repeat(15, 1fr)',
              textAlign: 'center',
              fontSize: 10,
              color: '#8c7365',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            <div>Open</div>
            {fretArray.slice(1).map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>

          {/* Guitar Strings Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
            {/* Inlay Position Dots Layer */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 50,
                right: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(15, 1fr)',
                pointerEvents: 'none',
              }}
            >
              {fretArray.slice(1).map((fret) => {
                const isSingle = SINGLE_DOT_FRETS.includes(fret);
                const isDouble = DOUBLE_DOT_FRETS.includes(fret);
                return (
                  <div
                    key={fret}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 36,
                    }}
                  >
                    {isSingle && (
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          backgroundColor: '#e5e7eb',
                          boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                          opacity: 0.75,
                        }}
                      />
                    )}
                    {isDouble && (
                      <>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#e5e7eb',
                            boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                            opacity: 0.75,
                          }}
                        />
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#e5e7eb',
                            boxShadow: '0 0 4px rgba(255,255,255,0.6)',
                            opacity: 0.75,
                          }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Continuous Unified Nickel-Silver Fret Wires Layer */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 50,
                right: 0,
                display: 'grid',
                gridTemplateColumns: 'repeat(15, 1fr)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            >
              {fretArray.slice(1).map((fret) => (
                <div
                  key={fret}
                  style={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  {/* Subtle Nickel-Silver Fret Bar Crown */}
                  <div
                    style={{
                      width: 2.5,
                      height: '100%',
                      backgroundColor: '#71717a',
                      backgroundImage:
                        'linear-gradient(90deg, #3f3f46 0%, #a1a1aa 45%, #71717a 80%, #27272a 100%)',
                      boxShadow: '1px 0 2px rgba(0, 0, 0, 0.7), -1px 0 1px rgba(255, 255, 255, 0.15)',
                      borderRadius: 1,
                      opacity: 0.85,
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Solid Bone/Brass Nut Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 48,
                width: 6,
                backgroundColor: '#eab308',
                backgroundImage:
                  'linear-gradient(90deg, #854d0e 0%, #fef08a 50%, #ca8a04 100%)',
                borderRadius: 2,
                boxShadow: '0 0 6px rgba(0, 0, 0, 0.6)',
                zIndex: 4,
                opacity: 0.9,
              }}
            />

            {/* Render Instrument Strings */}
            {activeStrings.map((stringDef) => {
              const isVibrating = vibratingStrings[stringDef.index];
              const chordFret = selectedChord?.frets[stringDef.index] ?? null;
              const rowTable = fretNoteTable[stringDef.index];

              return (
                <div
                  key={stringDef.index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '50px repeat(15, 1fr)',
                    alignItems: 'center',
                    height: 24,
                    position: 'relative',
                    zIndex: 5,
                  }}
                >
                  {/* String Label */}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#d4d4d8',
                      paddingLeft: 6,
                    }}
                  >
                    {stringDef.name.split(' ')[0]}
                  </div>

                  {/* Frets for this string */}
                  {fretArray.map((fret) => (
                    <FretCell
                      key={fret}
                      stringIdx={stringDef.index}
                      stringName={stringDef.name}
                      fret={fret}
                      freq={rowTable[fret].freq}
                      noteName={rowTable[fret].noteName}
                      thickness={stringDef.thickness}
                      isWound={stringDef.isWound}
                      isVibrating={isVibrating}
                      chordFret={chordFret}
                      isActivePlay={
                        activeFret?.stringIdx === stringDef.index && activeFret?.fret === fret
                      }
                      isHovered={
                        hoveredFret?.stringIdx === stringDef.index && hoveredFret?.fret === fret
                      }
                      onFretMouseDown={handleFretMouseDown}
                      onFretMouseEnter={handleFretMouseEnter}
                      onFretMouseLeave={handleFretMouseLeave}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Instructions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          backgroundColor: '#18181b',
          borderTop: '1px solid #27272a',
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          <span><strong>Tip:</strong> Click any string fret to play. Press <code>1-6</code> for open strings, or <code>Space</code> to strum the current chord!</span>
        </div>
        <div style={{ color: '#71717a' }}>Cords Box Audio DSP Engine Live</div>
      </div>
    </div>
  );
}
