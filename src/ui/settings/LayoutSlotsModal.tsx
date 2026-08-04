/**
 * LayoutSlotsModal.tsx — Saveable Layout Slots & Preset Template Manager
 *
 * Interactive 6-slot layout manager card allowing users to:
 * - Save current canvas wiring harness & circuit state to any slot
 * - Load saved layouts or default templates back onto the canvas
 * - Rename & reset slots with persistent localStorage sync
 */

import { useState } from 'react';
import { useSlotStore } from '@store/slotStore';
import { useCanvasStore } from '@store/canvasStore';

export function LayoutSlotsModal() {
  const { toggleSlotModal } = useCanvasStore();
  const { slots, activeSlotId, saveCurrentToSlot, loadSlot, renameSlot, resetSlotToDefault } =
    useSlotStore();

  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  function handleStartRename(slotId: string, currentName: string) {
    setEditingSlotId(slotId);
    setEditNameText(currentName);
  }

  function handleSaveRename(slotId: string) {
    if (editNameText.trim()) {
      renameSlot(slotId, editNameText.trim());
    }
    setEditingSlotId(null);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 780,
          maxWidth: '100%',
          backgroundColor: '#121318',
          border: '1px solid #27272a',
          borderRadius: 12,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 2px rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
          color: '#f4f4f5',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            backgroundColor: '#18181b',
            borderBottom: '1px solid #27272a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                backgroundColor: '#0369a1',
                border: '1px solid #0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#e0f2fe"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f9ff' }}>
                Saveable Layout Slots & Circuit Templates
              </h3>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>
                Save your canvas layout to persistent slots or load built-in wiring harness templates
              </span>
            </div>
          </div>

          <button
            onClick={toggleSlotModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              fontSize: 18,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* 6 Slots Grid */}
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {slots.map((slot) => {
            const isActive = activeSlotId === slot.slotId;
            const isEditing = editingSlotId === slot.slotId;
            const compCount = slot.data.instances.length;
            const edgeCount = slot.data.edges.length;
            const formattedTime = new Date(slot.updatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={slot.slotId}
                style={{
                  backgroundColor: isActive ? '#1e1b18' : '#18181b',
                  border: isActive ? '1px solid #f59e0b' : '1px solid #27272a',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 0 12px rgba(245, 158, 11, 0.2)' : 'none',
                }}
              >
                {/* Slot Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                      <input
                        type="text"
                        value={editNameText}
                        onChange={(e) => setEditNameText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(slot.slotId);
                        }}
                        style={{
                          flex: 1,
                          backgroundColor: '#09090b',
                          border: '1px solid #38bdf8',
                          borderRadius: 4,
                          color: '#ffffff',
                          padding: '2px 6px',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveRename(slot.slotId)}
                        style={{
                          padding: '2px 8px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isActive ? '#fbbf24' : '#f4f4f5',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {slot.name}
                      </span>
                      <button
                        onClick={() => handleStartRename(slot.slotId, slot.name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#71717a',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: 2,
                        }}
                        title="Rename Slot"
                      >
                        ✏️
                      </button>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isActive && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: '#d97706',
                          color: '#ffffff',
                          textTransform: 'uppercase',
                        }}
                      >
                        Active
                      </span>
                    )}
                    {slot.isCustom ? (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: '#0284c7',
                          color: '#e0f2fe',
                        }}
                      >
                        Custom Saved
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: '#3f3f46',
                          color: '#a1a1aa',
                        }}
                      >
                        Template
                      </span>
                    )}
                  </div>
                </div>

                {/* Slot Details */}
                <div style={{ fontSize: 11, color: '#a1a1aa', display: 'flex', gap: 12 }}>
                  <span>
                    📦 <strong>{compCount}</strong> {compCount === 1 ? 'Component' : 'Components'}
                  </span>
                  <span>
                    ⚡ <strong>{edgeCount}</strong> {edgeCount === 1 ? 'Wire' : 'Wires'}
                  </span>
                  <span style={{ color: '#71717a' }}>{formattedTime}</span>
                </div>

                {/* Slot Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      loadSlot(slot.slotId);
                      toggleSlotModal();
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: '#27272a',
                      color: '#f4f4f5',
                      border: '1px solid #3f3f46',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span>Load Slot</span>
                  </button>

                  <button
                    onClick={() => saveCurrentToSlot(slot.slotId)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: '#78350f',
                      color: '#fef3c7',
                      border: '1px solid #d97706',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    </svg>
                    <span>Save Current Here</span>
                  </button>

                  {slot.isCustom && (
                    <button
                      onClick={() => resetSlotToDefault(slot.slotId)}
                      style={{
                        padding: '6px 8px',
                        backgroundColor: '#27272a',
                        color: '#9ca3af',
                        border: '1px solid #3f3f46',
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: 'pointer',
                      }}
                      title="Reset Slot to Default Template"
                    >
                      ↺
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#18181b',
            borderTop: '1px solid #27272a',
            fontSize: 11,
            color: '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            💡 Saved layout slots persist automatically in your browser's local storage.
          </span>
          <button
            onClick={toggleSlotModal}
            style={{
              padding: '4px 12px',
              backgroundColor: '#27272a',
              color: '#f4f4f5',
              border: '1px solid #3f3f46',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
