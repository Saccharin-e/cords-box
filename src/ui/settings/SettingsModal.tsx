/**
 * SettingsModal — Comprehensive CAD Shortcuts & Controls Reference & Keybinding Customizer.
 * Allows users to view all app controls, rebind keyboard shortcuts, and view interactive mouse instructions.
 */

import { useState, useEffect } from 'react';
import { useKeybindingsStore, formatShortcut, type Keybinding } from '@store/keybindingsStore';

export function SettingsModal() {
  const {
    keybindings,
    isSettingsOpen,
    closeSettings,
    recordingId,
    setRecordingId,
    updateKeybinding,
    resetKeybindings,
  } = useKeybindingsStore();

  const [activeTab, setActiveTab] = useState<'shortcuts' | 'mouse'>('shortcuts');
  const [searchFilter, setSearchFilter] = useState('');

  // Key Recording Listener for custom keybinding customization
  useEffect(() => {
    if (!recordingId) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape if no modifier
      if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        setRecordingId(null);
        return;
      }

      // Ignore solo modifier keys during recording
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      let key = e.key;

      if (key === ' ') key = 'Space';

      if (recordingId) {
        updateKeybinding(recordingId, {
          key: key.toLowerCase() === key.toUpperCase() ? key : key.toLowerCase(),
          ctrl,
          shift,
          alt,
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingId, setRecordingId, updateKeybinding]);

  if (!isSettingsOpen) return null;

  const categories: Keybinding['category'][] = [
    'Editing',
    'Selection',
    'Transforms',
    'View & Canvas',
    'Tools',
  ];

  const allBindingsList = Object.values(keybindings);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(9, 9, 11, 0.75)',
        backdropFilter: 'blur(10px)',
        fontFamily: "'Inter', sans-serif",
      }}
      onClick={closeSettings}
    >
      <div
        style={{
          width: 720,
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f4f4f5',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #27272a 0%, #18181b 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <IconGear />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                CAD Controls & Keyboard Shortcuts
              </h2>
              <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0 }}>
                Customize keybindings & review standard interaction controls
              </p>
            </div>
          </div>

          <button
            onClick={closeSettings}
            style={{
              background: 'none',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconClose />
          </button>
        </div>

        {/* Modal Tabs & Search */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            backgroundColor: '#18181b',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveTab('shortcuts')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid',
                borderColor: activeTab === 'shortcuts' ? '#38bdf8' : 'transparent',
                backgroundColor: activeTab === 'shortcuts' ? 'rgba(56, 189, 248, 0.15)' : '#27272a',
                color: activeTab === 'shortcuts' ? '#38bdf8' : '#a1a1aa',
                cursor: 'pointer',
              }}
            >
              Keyboard Shortcuts ({allBindingsList.length})
            </button>
            <button
              onClick={() => setActiveTab('mouse')}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: '1px solid',
                borderColor: activeTab === 'mouse' ? '#38bdf8' : 'transparent',
                backgroundColor: activeTab === 'mouse' ? 'rgba(56, 189, 248, 0.15)' : '#27272a',
                color: activeTab === 'mouse' ? '#38bdf8' : '#a1a1aa',
                cursor: 'pointer',
              }}
            >
              Mouse & Canvas Gestures
            </button>
          </div>

          {activeTab === 'shortcuts' && (
            <input
              type="text"
              placeholder="Search shortcut..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                backgroundColor: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                padding: '5px 10px',
                color: '#e4e4e7',
                fontSize: 12,
                outline: 'none',
                width: 180,
              }}
            />
          )}
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {activeTab === 'shortcuts' ? (
            <div>
              {recordingId && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 12,
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid #eab308',
                    borderRadius: 8,
                    color: '#fef08a',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>
                    Press new key combination for <strong>{keybindings[recordingId]?.name}</strong>
                    ... (Press ESC to cancel)
                  </span>
                  <button
                    onClick={() => setRecordingId(null)}
                    style={{
                      background: 'none',
                      border: '1px solid #eab308',
                      color: '#fef08a',
                      borderRadius: 4,
                      padding: '2px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {categories.map((cat) => {
                const filtered = allBindingsList.filter(
                  (b) =>
                    b.category === cat &&
                    (b.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      formatShortcut(b).toLowerCase().includes(searchFilter.toLowerCase())),
                );

                if (filtered.length === 0) return null;

                return (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#38bdf8',
                        marginBottom: 8,
                        borderBottom: '1px solid #27272a',
                        paddingBottom: 4,
                      }}
                    >
                      {cat}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {filtered.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            backgroundColor: '#27272a',
                            border: '1px solid #3f3f46',
                            borderRadius: 8,
                          }}
                        >
                          <span style={{ fontSize: 12, color: '#e4e4e7' }}>{item.name}</span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '3px 8px',
                                backgroundColor: '#18181b',
                                border: '1px solid #52525b',
                                borderRadius: 4,
                                color: '#f4f4f5',
                                boxShadow: '0 2px 0 0 #3f3f46',
                              }}
                            >
                              {formatShortcut(item)}
                            </span>

                            <button
                              onClick={() => setRecordingId(item.id)}
                              style={{
                                padding: '2px 8px',
                                fontSize: 10,
                                borderRadius: 4,
                                border: '1px solid #52525b',
                                backgroundColor: recordingId === item.id ? '#eab308' : '#3f3f46',
                                color: recordingId === item.id ? '#18181b' : '#d4d4d8',
                                cursor: 'pointer',
                              }}
                            >
                              {recordingId === item.id ? 'Recording...' : 'Rebind'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Mouse Gestures & CAD Controls Reference */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ControlCard
                title="Marquee Selection"
                icon="🔲"
                desc="Left Click and drag on empty canvas background to select multiple components or wires simultaneously."
              />
              <ControlCard
                title="Multi-Component Group Move"
                icon="🖐️"
                desc="Left Click & drag any selected component to smoothly move all selected items in unison."
              />
              <ControlCard
                title="60 FPS Wire Endpoint Dragging"
                icon="🔌"
                desc="Click & drag the circular handles at wire endpoints to smoothly re-route or adjust wire paths in real-time."
              />
              <ControlCard
                title="Viewport Panning"
                icon="🖱️"
                desc="Hold Middle Mouse Button OR Alt + Right Click & Drag anywhere to pan around the canvas."
              />
              <ControlCard
                title="Zoom Canvas"
                icon="🔍"
                desc="Scroll Mouse Wheel up/down to zoom in and out smoothly relative to your cursor position."
              />
              <ControlCard
                title="Point-to-Point Wire Routing"
                icon="⚡"
                desc="Click any component solder lug, move cursor to target lug pin, and click to complete wire connection."
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#18181b',
          }}
        >
          <button
            onClick={resetKeybindings}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#f87171',
              cursor: 'pointer',
            }}
          >
            Reset All Shortcuts to Default
          </button>

          <button
            onClick={closeSettings}
            style={{
              padding: '6px 18px',
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: '#38bdf8',
              border: 'none',
              borderRadius: 6,
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlCard({ title, icon, desc }: { title: string; icon: string; desc: string }) {
  return (
    <div
      style={{
        padding: 14,
        backgroundColor: '#27272a',
        border: '1px solid #3f3f46',
        borderRadius: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>{title}</h4>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: '#a1a1aa', lineHeight: 1.4 }}>{desc}</p>
    </div>
  );
}

function IconGear() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
