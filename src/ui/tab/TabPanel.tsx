/**
 * TabPanel.tsx — Modern Studio DAW Tab Player & Interactive Timeline Visualizer
 *
 * Features:
 * - Sleek dark studio DAW interface with glowing neon playhead & measure markers
 * - Interactive timeline staff display with click-to-scrub/seek positioning
 * - Time ruler bar with MM:SS time indicators (0:00, 0:30, 1:00, 1:30, 2:00)
 * - Color-coded string gauge badges (High E down to Low E)
 * - Technique articulation badges (bends, slides, mutes, legato, vibrato)
 * - Long multi-section demo tab suites (~1.5 to 2 minutes max per demo)
 * - Web MIDI .MID file import and export
 */

import { useState, useEffect, useRef } from 'react';
import { parseAsciiTab } from '@audio/tab/tabParser';
import { tabScheduler } from '@audio/tab/tabScheduler';
import type { TabScore } from '@audio/tab/tabTypes';
import { useCanvasStore } from '@store/canvasStore';
import { useTuningStore } from '@store/tuningStore';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { Download, Edit2, Music, Timer, Upload, X } from 'lucide-react';

export const TAB_PRESETS: { id: string; label: string; tab: string; bpm: number; durationDesc: string; tuningId: string }[] = [
  {
    id: 'back_in_black',
    label: 'AC/DC - Back in Black (Main Riff)',
    bpm: 94,
    tuningId: 'standard_e',
    durationDesc: '~15s (4 Measures)',
    tab: `e|-----------------------|---3p0-----------------|-----------------------|-----------------------|
B|-----------3---3-------|-------3p0-------------|-----------3---3-------|-----------------------|
G|-----------2---2---2-2-|-----------2b4r2-0v----|-----------2---2---2-2-|-----------------------|
D|---2-------0---0---2-2-|-----------------------|---2-------0---0---2-2-|-------2-------2-------|
A|---2---------------0-0-|-----------------------|---2---------------0-0-|---2-4---2-4-5---2-4-6-|
E|---0-------------------|-----------------------|---0-------------------|-----------------------|`,
  },
  {
    id: 'little_wing',
    label: 'Jimi Hendrix - Little Wing (Intro Snippet)',
    bpm: 70,
    tuningId: 'eb_standard',
    durationDesc: '~15s (4 Measures)',
    tab: `eb|-----------------------|-------0---------------|-----------------------|-----------------------|
Bb|-------8---8-----------|-------0h1-0v----------|---7/8-8\\7---5v--------|-------1---1h3-1v------|
Gb|-------7h9-9---9v------|-------0-------0-------|---7/9-9\\7---5v--------|-------0h2-2---0-------|
Db|-------7h9-9---9v------|-------0h2---------2---|---7/9-9\\7---5v--------|-------0h2-2-------2---|
Ab|---0-------------------|-----------------------|-------------0---------|---3-------------------|
Eb|-----------------------|---0-------------------|-----------------------|-----------------------|`,
  },
  {
    id: 'master_of_puppets',
    label: 'Metallica - Master of Puppets (Main Riff)',
    bpm: 212,
    tuningId: 'standard_e',
    durationDesc: '~10s (4 Measures)',
    tab: `e|-----------------------|-------------------|-----------------------|-------------------|
B|-----------------------|-------------------|-----------------------|-------------------|
G|-----------------------|-------------------|-----------------------|-------------------|
D|-----------------------|-------------------|-----------------------|-------------------|
A|---------2---------3---|---------4---3---2-|---------2---------3---|---------4---3---2-|
E|---0-1-2---0-1-2-3-----|---0-1-2---0---0---|---0-1-2---0-1-2-3-----|---0-1-2---0---0---|`,
  },
  {
    id: 'come_as_you_are',
    label: 'Nirvana - Come As You Are (Intro Riff)',
    bpm: 120,
    tuningId: 'd_standard',
    durationDesc: '~12s (4 Measures)',
    tab: `d|-----------------------|-----------------------|-----------------------|-----------------------|
A|-----------------------|-----------------------|-----------------------|-----------------------|
F|-----------------------|-----------------------|-----------------------|-----------------------|
C|-----------------------|-----------------------|-----------------------|-----------------------|
G|-----------0---0-------|---2-------2-----------|-----------0---0-------|---2-------2-----------|
D|---0-0-1-2---2---2-2---|-----2-1-0---0-0-0-----|---0-0-1-2---2---2-2---|-----2-1-0---0-0-0-----|`,
  },
  {
    id: 'cant_stop',
    label: 'RHCP - Can\'t Stop (Main Riff)',
    bpm: 94,
    tuningId: 'standard_e',
    durationDesc: '~15s (4 Measures)',
    tab: `e|-----------------------|-----------------------|-----------------------|-----------------------|
B|-----------------------|-----------------------|-----------------------|-----------------------|
G|-------7h9-9---7h9-9---|-------7h9-9---7h9-9---|-------7h9-9---7h9-9---|-------7h9-9---7h9-9---|
D|---x-x-x---x-x-x---x---|---x-x-x---x-x-x---x---|---x-x-x---x-x-x---x---|---x-x-x---x-x-x---x---|
A|---7-7-----------------|---5-5-----------------|-----------------------|-----------------------|
E|-----------0-0---------|-----------0-0---------|---8-8-----0-0---------|---7-7-----0-0---------|`,
  },
  {
    id: 'comfortably_numb',
    label: 'Pink Floyd - Comfortably Numb (Solo & Harmonics)',
    bpm: 68,
    tuningId: 'standard_e',
    durationDesc: '~18s (4 Measures)',
    tab: `e|---<12>----------------|-----------------------|---14b16---14v---------|---12h14p12-10/12-12v--|
B|-------<12>------------|---10/12---12v---------|-----------------------|-----------------------|
G|-----------<12>--------|-----------------------|-----------------------|-----------------------|
D|---------------<12>----|-----------------------|-----------------------|-----------------------|
A|-----------------------|-----------------------|-----------------------|-----------------------|
E|-----------------------|-----------------------|-----------------------|-----------------------|`,
  },
];

const STRING_COLORS = ['#ec4899', '#38bdf8', '#34d399', '#fbbf24', '#f97316', '#ef4444'];

export function TabPanel() {
  const toggleTabPanel = useCanvasStore((s) => s.toggleTabPanel);
  const currentTuning = useTuningStore((s) => s.currentPreset);
  const setTuning = useTuningStore((s) => s.setTuning);
  const [selectedPresetId, setSelectedPresetId] = useState('back_in_black');
  const [tabText, setTabText] = useState(TAB_PRESETS[0].tab);
  const [bpm, setBpm] = useState(TAB_PRESETS[0].bpm);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [parsedScore, setParsedScore] = useState<TabScore | null>(null);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);

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
        const playheadX = 50 + beat * BEAT_PX;
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

  const handleParse = (
    textToParse = tabText,
    targetBpm = bpm,
    targetTuningId = TAB_PRESETS.find((p) => p.id === selectedPresetId)?.tuningId || 'standard_e',
  ) => {
    const score = parseAsciiTab(textToParse, targetBpm, targetTuningId);
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
    setTuning(preset.tuningId);
    handleParse(preset.tab, preset.bpm, preset.tuningId);
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

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineRef.current.scrollLeft - 50;
    const BEAT_PX = 44;
    const clickedBeat = Math.max(0, clickX / BEAT_PX);
    tabScheduler.seek(clickedBeat);
  };

  const totalMeasures = parsedScore ? Math.max(4, parsedScore.measures.length) : 16;
  const totalBeats = totalMeasures * 4;
  const BEAT_PX = 44;
  const totalDurationSec = (totalBeats * 60) / Math.max(30, bpm);
  const currentDurationSec = (currentBeat * 60) / Math.max(30, bpm);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div
      style={{
        width: '640px',
        backgroundColor: '#0c0d10',
        borderRadius: '10px',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid #27272a',
        boxShadow: isDragging ? '0 24px 70px rgba(0,0,0,0.95)' : '0 16px 50px rgba(0,0,0,0.85)',
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        userSelect: isDragging ? 'none' : 'auto',
        overflow: 'hidden',
        padding: '14px 16px',
      }}
    >
      {/* Draggable Header (App Theme with Neon Accent) */}
      <div
        onPointerDown={handlePointerDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: isDragging ? 'grabbing' : 'grab',
          borderBottom: '1px solid #27272a',
          margin: '-14px -16px 4px -16px',
          padding: '12px 16px 10px 16px',
          backgroundColor: '#13141a',
          borderTopLeftRadius: '10px',
          borderTopRightRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}><Music size={15} /></span>
          <div>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.3px' }}>
              Tab Player
            </h3>
          </div>
        </div>

        <Button
          variant="icon"
          aria-label="Close Panel"
          onClick={toggleTabPanel}
          style={{
            color: '#a1a1aa',
            fontSize: '14px',
            padding: '2px 8px',
            borderRadius: '5px',
          }}
        >
          <X size={14} />
        </Button>
      </div>

      {/* Preset Selector & Tempo Control Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Preset:</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span
                style={{
                  color: '#38bdf8',
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                {currentTuning.label} ({currentTuning.description})
              </span>
              <span style={{ color: '#f59e0b', fontSize: '11px' }}>
                {TAB_PRESETS.find((p) => p.id === selectedPresetId)?.durationDesc}
              </span>
              <Button
                onClick={() => setIsTextEditorOpen(!isTextEditorOpen)}
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: isTextEditorOpen ? '#0c4a6e' : 'transparent',
                  color: isTextEditorOpen ? '#38bdf8' : '#a1a1aa',
                  border: isTextEditorOpen ? '1px solid #0284c7' : '1px solid #3f3f46',
                  borderRadius: '4px',
                }}
              >
                <Edit2 size={14} /> Edit Tab Text
              </Button>
            </div>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetSelect(e.target.value)}
            style={{
              backgroundColor: '#14151a',
              color: '#fbbf24',
              border: '1px solid #3f3f46',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            {TAB_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.durationDesc}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: '150px' }}>
          <Slider
            label="Tempo (BPM)"
            value={bpm}
            min={40}
            max={240}
            step={1}
            unit="raw"
            accentColor="#38bdf8"
            onChange={(val) => handleBpmChange(val)}
            containerStyle={{ marginTop: 0 }}
          />
        </div>
      </div>

      {/* ASCII Tab Textarea (Paper & Ink Style ONLY) */}
      {isTextEditorOpen && (
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
            backgroundColor: '#ffffff',
            color: '#1a1a1a',
            border: '1.5px solid #1a1a1a',
            borderRadius: '4px',
            padding: '8px',
            boxSizing: 'border-box',
            resize: 'vertical',
            lineHeight: '1.35',
          }}
        />
      )}

      {/* Modern Studio DAW Timeline Staff Display */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '11px', color: '#a1a1aa', fontWeight: 700 }}>
          <span style={{ color: '#a3e635', fontFamily: 'monospace', fontWeight: 800 }}>
            <Timer size={14} /> {formatTime(currentDurationSec)} / {formatTime(totalDurationSec)} &nbsp;•&nbsp; <span style={{ color: '#f59e0b' }}>M{Math.floor(currentBeat / 4) + 1} (Beat {currentBeat.toFixed(1)})</span>
          </span>
        </div>

        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{
            position: 'relative',
            width: '100%',
            height: '175px',
            backgroundColor: '#090a0d',
            backgroundImage: `
              linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
            `,
            backgroundSize: '11px 22px',
            border: '1px solid #27272a',
            borderRadius: '6px',
            overflowX: 'auto',
            overflowY: 'hidden',
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: `${totalBeats * BEAT_PX + 60}px`,
              height: '100%',
              paddingLeft: '50px',
              boxSizing: 'border-box',
            }}
          >
            {/* Sticky Left String Headers Column */}
            <div
              style={{
                position: 'sticky',
                left: 0,
                top: 0,
                width: '48px',
                height: '100%',
                backgroundColor: '#111217',
                borderRight: '1px solid #27272a',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                padding: '24px 0 6px 0',
                boxSizing: 'border-box',
              }}
            >
              {currentTuning.strings.map((str, idx) => {
                const color = STRING_COLORS[idx] || '#a1a1aa';
                const shortName = str.name.split(' ')[0] || str.name;
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 800,
                        color: color,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        border: `1px solid ${color}40`,
                      }}
                    >
                      {shortName}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Top Measure & Time Ruler Bar */}
            {Array.from({ length: totalMeasures }, (_, mIdx) => {
              const measureBeat = mIdx * 4;
              const measureSec = (measureBeat * 60) / Math.max(30, bpm);
              return (
                <div
                  key={mIdx}
                  style={{
                    position: 'absolute',
                    left: `${50 + mIdx * 4 * BEAT_PX}px`,
                    top: 0,
                    height: '100%',
                    width: `${4 * BEAT_PX}px`,
                    borderLeft: '1px solid #3f3f46',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9px',
                        color: '#fbbf24',
                        fontWeight: 800,
                        backgroundColor: '#1c1917',
                        padding: '1px 5px',
                        border: '1px solid #78350f',
                        borderRadius: '3px',
                      }}
                    >
                      M{mIdx + 1}
                    </span>
                    <span style={{ fontSize: '9px', color: '#71717a', fontFamily: 'monospace' }}>
                      {formatTime(measureSec)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* 6 Horizontal Metallic Staff Lines */}
            {currentTuning.strings.map((_, sIdx) => {
              const color = STRING_COLORS[sIdx] || '#a1a1aa';
              return (
                <div
                  key={sIdx}
                  style={{
                    position: 'absolute',
                    left: '50px',
                    top: `${30 + sIdx * 22}px`,
                    width: `${totalBeats * BEAT_PX}px`,
                    height: '1px',
                    backgroundColor: `${color}35`,
                    borderBottom: '1px solid #18181b',
                    pointerEvents: 'none',
                  }}
                />
              );
            })}

            {/* Interactive Note Badges & Technique Badges */}
            {parsedScore?.measures.flatMap((m) =>
              m.beats.flatMap((b) =>
                b.notes.map((n, nIdx) => {
                  const absoluteBeat = m.index * 4 + b.offsetBeats;
                  const centerPx = 50 + absoluteBeat * BEAT_PX;
                  const topPx = 20 + n.stringIdx * 22;
                  const isCurrent = Math.abs(currentBeat - absoluteBeat) < 0.25;

                  let badgeText = `${n.fret}`;
                  let badgeBg = isCurrent ? '#38bdf8' : '#18181b';
                  let badgeColor = isCurrent ? '#000000' : '#e4e4e7';
                  let badgeBorder = isCurrent ? '1px solid #7dd3fc' : '1px solid #3f3f46';

                  if (n.articulation === 'hammer') {
                    badgeText += 'h';
                    if (!isCurrent) { badgeBg = '#27272a'; badgeColor = '#fbbf24'; badgeBorder = '1px solid #d97706'; }
                  } else if (n.articulation === 'pull') {
                    badgeText += 'p';
                    if (!isCurrent) { badgeBg = '#27272a'; badgeColor = '#f59e0b'; badgeBorder = '1px solid #d97706'; }
                  } else if (n.articulation === 'slide_up') {
                    badgeText += '/';
                    if (!isCurrent) { badgeBg = '#14532d'; badgeColor = '#4ade80'; badgeBorder = '1px solid #16a34a'; }
                  } else if (n.articulation === 'slide_down') {
                    badgeText += '\\';
                    if (!isCurrent) { badgeBg = '#14532d'; badgeColor = '#4ade80'; badgeBorder = '1px solid #16a34a'; }
                  } else if (n.articulation === 'bend') {
                    badgeText += 'b';
                    if (!isCurrent) { badgeBg = '#0c4a6e'; badgeColor = '#38bdf8'; badgeBorder = '1px solid #0284c7'; }
                  } else if (n.articulation === 'vibrato') {
                    badgeText += '~';
                    if (!isCurrent) { badgeBg = '#4c1d95'; badgeColor = '#c084fc'; badgeBorder = '1px solid #7c3aed'; }
                  } else if (n.articulation === 'mute') {
                    badgeText = 'x';
                    if (!isCurrent) { badgeBg = '#881337'; badgeColor = '#fda4af'; badgeBorder = '1px solid #e11d48'; }
                  }

                  return (
                    <div
                      key={`${m.index}-${b.offsetBeats}-${n.stringIdx}-${nIdx}`}
                      style={{
                        position: 'absolute',
                        left: `${centerPx - 11}px`,
                        top: `${topPx}px`,
                        minWidth: '22px',
                        height: '20px',
                        padding: '0 4px',
                        borderRadius: '4px',
                        backgroundColor: badgeBg,
                        color: badgeColor,
                        border: badgeBorder,
                        fontSize: '10px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: isCurrent ? 15 : 6,
                        boxShadow: isCurrent ? '0 0 12px rgba(56, 189, 248, 0.8)' : 'none',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {badgeText}
                    </div>
                  );
                }),
              ),
            )}

            {/* Glowing Laser Playhead Line */}
            <div
              style={{
                position: 'absolute',
                left: `${50 + currentBeat * BEAT_PX}px`,
                top: 0,
                width: '2px',
                height: '100%',
                background: 'linear-gradient(to bottom, #ef4444, #f97316)',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.95), 0 0 4px rgba(249, 115, 22, 0.8)',
                zIndex: 18,
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* Control Action Buttons (App Theme) */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Button
          onClick={() => handleParse()}
          style={{
            padding: '6px 12px',
            backgroundColor: '#27272a',
            color: '#e4e4e7',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          Parse & Sync
        </Button>

        <Button
          onClick={handlePlayToggle}
          style={{
            padding: '6px 18px',
            backgroundColor: isPlaying ? '#dc2626' : '#16a34a',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '12px',
            boxShadow: isPlaying ? '0 0 10px rgba(220, 38, 38, 0.5)' : '0 0 10px rgba(22, 163, 74, 0.4)',
          }}
        >
          {isPlaying ? 'Pause' : 'Play Tab'}
        </Button>

        <Button
          onClick={handleStop}
          style={{
            padding: '6px 14px',
            backgroundColor: '#3f3f46',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          Stop
        </Button>

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
          <span><Download size={14} /> Import .MID</span>
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

        <Button
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
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <Upload size={14} /> Export .MID
        </Button>
      </div>
    </div>
  );
}
