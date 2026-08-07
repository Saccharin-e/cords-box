/**
 * TabPanel.tsx — Draggable ASCII Tab Editor & Interactive Timeline Roll Visualizer
 *
 * App-themed dark container with traditional paper & ink tab sheet roll display.
 */

import { useState, useEffect, useRef } from 'react';
import { parseAsciiTab } from '@audio/tab/tabParser';
import { tabScheduler } from '@audio/tab/tabScheduler';
import type { TabScore } from '@audio/tab/tabTypes';
import { useCanvasStore } from '@store/canvasStore';

export const TAB_PRESETS: { id: string; label: string; tab: string; bpm: number }[] = [
  {
    id: 'articulation_demo',
    label: '✨ Technique Showcase (Slides, Bends, Legato, Mutes)',
    bpm: 100,
    tab: `e|---5h7p5---7/9---|---12b14---12v-----|---x-7---x-9---|---5/7\\5-----------|
B|---------7-------|-------------------|---x-8---x-10--|---------7v--------|
G|-----------------|-------------------|---x-7---x-9---|-------------5h7---|
D|-----------------|-------------------|---------------|-------------------|
A|-----------------|-------------------|---------------|-------------------|
E|-----------------|-------------------|---------------|-------------------|`,
  },
  {
    id: 'metal_palm_mute',
    label: '⚡ Heavy Metal Riff (Palm Muting & Pitch Bends)',
    bpm: 120,
    tab: `e|-------------------|-------------------|-------------------|-------------------|
B|-------------------|-------------------|---10b12---10v-----|-------------------|
G|-------------------|---7/9---9v--------|-------------------|---9\\7---7v--------|
D|---x-2---x-2---x-2-|-------------------|-------------------|-------------------|
A|---x-2---x-2---x-2-|-------------------|-------------------|-------------------|
E|---x-0---x-0---x-0-|-------------------|-------------------|-------------------|`,
  },
  {
    id: 'bass_groove',
    label: '🎸 Bass Line (Slides, Mutes & Hammer-ons)',
    bpm: 96,
    tab: `e|-------------------|-------------------|-------------------|-------------------|
B|-------------------|-------------------|-------------------|-------------------|
G|-------7---7/9---|-------7-----------|-------5---5h7---|-------------------|
D|-----7---7-------|-----7---7\\5-------|-----5---5-------|-------5-----------|
A|---5-------------|---5---------7-----|---3-------------|-----5---5\\3-------|
E|-----------------|-------------------|-----------------|---3---------5-----|`,
  },
  {
    id: 'rock_riff',
    label: 'Classic Rock Riff (Smoke on the Water)',
    bpm: 112,
    tab: `e|-------------------|-------------------|-------------------|-------------------|
B|-------------------|-------------------|-------------------|-------------------|
G|---0---3---5-------|---0---3---6-5-----|---0---3---5-------|---3---0-----------|
D|---0---3---5-------|---0---3---6-5-----|---0---3---5-------|---3---0-----------|
A|-------------------|-------------------|-------------------|-------------------|
E|-------------------|-------------------|-------------------|-------------------|`,
  },
  {
    id: 'blues_lick',
    label: 'Pentatonic Blues Solo (E Minor)',
    bpm: 96,
    tab: `e|---12---10-------|-------------------|-------------------|-------------------|
B|------------12---|---10-8------------|-------------------|-------------------|
G|-----------------|--------9---7-9----|---7---------------|-------------------|
D|-----------------|-------------------|-----9-7-5---------|---7-5-------------|
A|-----------------|-------------------|-----------7-------|-------7-5---------|
E|-----------------|-------------------|-------------0-----|-----------7-0-----|`,
  },
];

const STRING_NAMES = ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'];

export function TabPanel() {
  const toggleTabPanel = useCanvasStore((s) => s.toggleTabPanel);
  const [selectedPresetId, setSelectedPresetId] = useState('articulation_demo');
  const [tabText, setTabText] = useState(TAB_PRESETS[0].tab);
  const [bpm, setBpm] = useState(TAB_PRESETS[0].bpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [parsedScore, setParsedScore] = useState<TabScore | null>(null);

  // Window Dragging State
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('textarea') ||
      target.closest('a')
    ) {
      return;
    }

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };
  }

  useEffect(() => {
    const unsubState = tabScheduler.subscribeStateChange((playing) => setIsPlaying(playing));
    const unsubBeat = tabScheduler.subscribeBeat((beat) => {
      setCurrentBeat(beat);
      // Auto-scroll timeline smoothly
      if (timelineRef.current) {
        const BEAT_PX = 44;
        const playheadX = 40 + beat * BEAT_PX;
        const containerW = timelineRef.current.clientWidth;
        timelineRef.current.scrollLeft = Math.max(0, playheadX - containerW / 2);
      }
    });

    handleParse();

    return () => {
      unsubState();
      unsubBeat();
    };
  }, []);

  const handleParse = (textToParse = tabText, targetBpm = bpm) => {
    const score = parseAsciiTab(textToParse, targetBpm);
    setParsedScore(score);
    tabScheduler.setScore(score);
  };

  useEffect(() => {
    handleParse(tabText, bpm);
  }, [tabText, bpm]);

  const handlePresetSelect = (presetId: string) => {
    const preset = TAB_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setTabText(preset.tab);
    setBpm(preset.bpm);
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      tabScheduler.pause();
    } else {
      if (!parsedScore) handleParse();
      tabScheduler.start();
    }
  };

  const handleStop = () => {
    tabScheduler.stop();
  };

  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    tabScheduler.setBpm(newBpm);
  };

  const totalBeats = parsedScore ? Math.max(4, parsedScore.measures.length * 4) : 16;
  const BEAT_PX = 44;

  return (
    <div
      style={{
        width: '580px',
        backgroundColor: '#141417', // App Dark Theme Panel
        borderRadius: '8px',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        border: '1px solid #27272a',
        boxShadow: isDragging ? '0 20px 60px rgba(0,0,0,0.9)' : '0 12px 40px rgba(0,0,0,0.75)',
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        overflow: 'hidden',
        padding: '12px 14px',
      }}
    >
      {/* Draggable Header (App Theme) */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderBottom: '1px solid #27272a',
          paddingBottom: '8px',
          margin: '-12px -14px 4px -14px',
          padding: '10px 14px 8px 14px',
          backgroundColor: '#18181b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🎼</span>
          <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>
            Guitar Tab Player & Timeline Visualizer
          </h3>
        </div>

        <button
          onClick={toggleTabPanel}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Preset Selector & Tempo Control Bar (App Theme) */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>Song / Riff Preset:</label>
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetSelect(e.target.value)}
            style={{
              backgroundColor: '#09090b',
              color: '#fbbf24',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              fontSize: '12px',
              padding: '6px 8px',
              cursor: 'pointer',
            }}
          >
            {TAB_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.bpm} BPM)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '130px' }}>
          <label style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>Tempo: {bpm} BPM</label>
          <input
            type="range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value))}
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* ASCII Tab Textarea (Paper & Ink Style ONLY) */}
      <textarea
        value={tabText}
        onChange={(e) => setTabText(e.target.value)}
        rows={6}
        placeholder="Paste 6-line ASCII guitar tab here..."
        style={{
          width: '100%',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: '#ffffff', // Parchment paper sheet
          color: '#1a1a1a', // Black ink
          border: '1.5px solid #1a1a1a',
          borderRadius: 0, // Sharp square paper edge
          padding: '8px',
          boxSizing: 'border-box',
          resize: 'vertical',
          lineHeight: '1.35',
        }}
      />

      {/* Traditional Staff Roll Display (Paper & Ink Style ONLY) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>
          <span style={{ color: '#38bdf8' }}>Timeline Staff Display</span>
          <span>
            Beat {currentBeat.toFixed(1)} / {totalBeats}
          </span>
        </div>

        <div
          ref={timelineRef}
          style={{
            position: 'relative',
            width: '100%',
            height: '145px',
            backgroundColor: '#ffffff', // Paper sheet
            border: '1.5px solid #1a1a1a', // Sharp ink border
            borderRadius: 0, // Sharp paper edge
            overflowX: 'auto',
            overflowY: 'hidden',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${totalBeats * BEAT_PX + 45}px`,
              height: '100%',
              paddingLeft: '40px',
              boxSizing: 'border-box',
            }}
          >
            {/* String Headers (Left Sticky Paper Column) */}
            <div
              style={{
                position: 'sticky',
                left: 0,
                top: 0,
                width: '38px',
                height: '100%',
                backgroundColor: '#f5f0e6',
                borderRight: '1.5px solid #1a1a1a',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                padding: '16px 0 6px 0',
                boxSizing: 'border-box',
              }}
            >
              {STRING_NAMES.map((name, idx) => (
                <span key={idx} style={{ fontSize: '10px', color: '#1a1a1a', textAlign: 'center', fontWeight: 800 }}>
                  {name}
                </span>
              ))}
            </div>

            {/* Measure Bar Dividers & Measure Labels */}
            {Array.from({ length: Math.ceil(totalBeats / 4) }, (_, mIdx) => (
              <div
                key={mIdx}
                style={{
                  position: 'absolute',
                  left: `${40 + mIdx * 4 * BEAT_PX}px`,
                  top: 0,
                  height: '100%',
                  width: `${4 * BEAT_PX}px`,
                  borderLeft: '2px solid #1a1a1a',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '6px',
                    fontSize: '9px',
                    color: '#1a1a1a',
                    fontWeight: 800,
                    backgroundColor: '#e6ded1',
                    padding: '0 4px',
                    border: '1px solid #1a1a1a',
                    borderRadius: 0,
                  }}
                >
                  M{mIdx + 1}
                </span>
              </div>
            ))}

            {/* 6 Horizontal Staff Lines */}
            {STRING_NAMES.map((_, sIdx) => (
              <div
                key={sIdx}
                style={{
                  position: 'absolute',
                  left: '40px',
                  top: `${22 + sIdx * 19}px`,
                  width: `${totalBeats * BEAT_PX}px`,
                  height: '1px',
                  backgroundColor: '#d0caaf',
                }}
              />
            ))}

            {/* Sharp Paper Note Badges */}
            {parsedScore?.measures.flatMap((m) =>
              m.beats.flatMap((b) =>
                b.notes.map((n, nIdx) => {
                  const absoluteBeat = m.index * 4 + b.offsetBeats;
                  const centerPx = 40 + absoluteBeat * BEAT_PX;
                  const topPx = 13 + n.stringIdx * 19;
                  const isCurrent = Math.abs(currentBeat - absoluteBeat) < 0.25;

                  let badge = `${n.fret}`;
                  if (n.articulation === 'hammer') badge += 'h';
                  if (n.articulation === 'pull') badge += 'p';
                  if (n.articulation === 'slide_up') badge += '/';
                  if (n.articulation === 'mute') badge = 'x';

                  return (
                    <div
                      key={`${m.index}-${b.offsetBeats}-${n.stringIdx}-${nIdx}`}
                      style={{
                        position: 'absolute',
                        left: `${centerPx - 10}px`,
                        top: `${topPx}px`,
                        width: '20px',
                        height: '18px',
                        borderRadius: 0,
                        backgroundColor: isCurrent ? '#1a1a1a' : '#ffffff',
                        color: isCurrent ? '#ffffff' : '#1a1a1a',
                        border: '1.5px solid #1a1a1a',
                        fontSize: '10px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: isCurrent ? 8 : 4,
                      }}
                    >
                      {badge}
                    </div>
                  );
                }),
              ),
            )}

            {/* Red Conductor Playhead Line */}
            <div
              style={{
                position: 'absolute',
                left: `${40 + currentBeat * BEAT_PX}px`,
                top: 0,
                width: '2px',
                height: '100%',
                backgroundColor: '#b91c1c',
                zIndex: 9,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Control Action Buttons (App Theme) */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => handleParse()}
          style={{
            padding: '6px 12px',
            backgroundColor: '#27272a',
            color: '#e4e4e7',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Parse & Sync
        </button>

        <button
          onClick={handlePlayToggle}
          style={{
            padding: '6px 18px',
            backgroundColor: isPlaying ? '#dc2626' : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '12px',
          }}
        >
          {isPlaying ? 'Pause' : 'Play Tab'}
        </button>

        <button
          onClick={handleStop}
          style={{
            padding: '6px 14px',
            backgroundColor: '#3f3f46',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Stop
        </button>

        {/* MIDI File Ingestion & Live Web MIDI Controller */}
        <label
          style={{
            padding: '6px 12px',
            backgroundColor: '#1d4ed8',
            color: '#ffffff',
            border: '1px solid #3b82f6',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: 'auto',
          }}
        >
          <span>📥 Import .MID</span>
          <input
            type="file"
            accept=".mid,.midi"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const buffer = await file.arrayBuffer();
              try {
                const { parseMidiFileBuffer } = await import('@audio/midi/midiParser');
                const score = parseMidiFileBuffer(buffer);
                setParsedScore(score);
                setBpm(score.tempoBpm || 120);
                tabScheduler.setScore(score);
              } catch (err) {
                console.warn('MIDI parse error:', err);
              }
            }}
            style={{ display: 'none' }}
          />
        </label>

        <button
          onClick={async () => {
            if (!parsedScore) return;
            const { downloadMidiFile } = await import('@audio/midi/midiExporter');
            downloadMidiFile(parsedScore);
          }}
          style={{
            padding: '6px 12px',
            backgroundColor: '#059669',
            color: '#ffffff',
            border: '1px solid #10b981',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          📤 Export .MID
        </button>
      </div>
    </div>
  );
}
