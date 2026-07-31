/**
 * keybindingsStore — Customizable CAD Keyboard Shortcuts and Controls Store.
 * Supports persistent custom keybindings in localStorage and standard CAD shortcuts.
 */

import { create } from 'zustand';

export interface Keybinding {
  id: string;
  name: string;
  category: 'Editing' | 'Selection' | 'Transforms' | 'View & Canvas' | 'Tools';
  key: string; // e.g. "z", "c", "r", "Delete", "ArrowUp", "?"
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export const DEFAULT_KEYBINDINGS: Record<string, Keybinding> = {
  undo: { id: 'undo', name: 'Undo', category: 'Editing', key: 'z', ctrl: true },
  redo: { id: 'redo', name: 'Redo', category: 'Editing', key: 'y', ctrl: true },
  copy: { id: 'copy', name: 'Copy Selected', category: 'Editing', key: 'c', ctrl: true },
  paste: { id: 'paste', name: 'Paste Clipboard', category: 'Editing', key: 'v', ctrl: true },
  duplicate: {
    id: 'duplicate',
    name: 'Duplicate Selected',
    category: 'Editing',
    key: 'd',
    ctrl: true,
  },
  delete: {
    id: 'delete',
    name: 'Delete Selected (Component/Wire)',
    category: 'Editing',
    key: 'Delete',
  },

  selectAll: { id: 'selectAll', name: 'Select All', category: 'Selection', key: 'a', ctrl: true },
  deselect: { id: 'deselect', name: 'Deselect / Cancel', category: 'Selection', key: 'Escape' },

  rotateCw: { id: 'rotateCw', name: 'Rotate 90° CW', category: 'Transforms', key: 'r' },
  rotateCcw: {
    id: 'rotateCcw',
    name: 'Rotate 90° CCW',
    category: 'Transforms',
    key: 'r',
    shift: true,
  },
  flipH: { id: 'flipH', name: 'Flip Horizontal', category: 'Transforms', key: 'h' },
  flipV: { id: 'flipV', name: 'Flip Vertical', category: 'Transforms', key: 'v' },
  group: { id: 'group', name: 'Group Components', category: 'Transforms', key: 'g', ctrl: true },
  ungroup: {
    id: 'ungroup',
    name: 'Ungroup Components',
    category: 'Transforms',
    key: 'g',
    ctrl: true,
    shift: true,
  },

  snapGrid: {
    id: 'snapGrid',
    name: 'Toggle Snap to Grid',
    category: 'View & Canvas',
    key: 's',
    shift: true,
  },
  toggleLabels: {
    id: 'toggleLabels',
    name: 'Toggle Text Labels',
    category: 'View & Canvas',
    key: 'l',
  },
  toggleFullscreen: {
    id: 'toggleFullscreen',
    name: 'Toggle Fullscreen Mode',
    category: 'View & Canvas',
    key: 'f',
    shift: true,
  },
  toggleWiring: {
    id: 'toggleWiring',
    name: 'Toggle Wiring Mode',
    category: 'Tools',
    key: 'w',
  },
  exportCanvas: {
    id: 'exportCanvas',
    name: 'Export Image / PDF',
    category: 'Tools',
    key: 'e',
    ctrl: true,
  },
  openSettings: {
    id: 'openSettings',
    name: 'Controls & Shortcuts Settings',
    category: 'Tools',
    key: '?',
  },

  nudgeUp: { id: 'nudgeUp', name: 'Nudge Up', category: 'Editing', key: 'ArrowUp' },
  nudgeDown: { id: 'nudgeDown', name: 'Nudge Down', category: 'Editing', key: 'ArrowDown' },
  nudgeLeft: { id: 'nudgeLeft', name: 'Nudge Left', category: 'Editing', key: 'ArrowLeft' },
  nudgeRight: { id: 'nudgeRight', name: 'Nudge Right', category: 'Editing', key: 'ArrowRight' },
};

const STORAGE_KEY = 'cords_box_keybindings_v1';

function loadSavedKeybindings(): Record<string, Keybinding> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Keybinding>;
      return { ...DEFAULT_KEYBINDINGS, ...parsed };
    }
  } catch {
    // Ignore storage errors
  }
  return { ...DEFAULT_KEYBINDINGS };
}

interface KeybindingsState {
  keybindings: Record<string, Keybinding>;
  isSettingsOpen: boolean;
  recordingId: string | null;

  toggleSettings: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  setRecordingId: (id: string | null) => void;
  updateKeybinding: (id: string, binding: Partial<Keybinding>) => void;
  resetKeybindings: () => void;
}

export const useKeybindingsStore = create<KeybindingsState>((set, get) => ({
  keybindings: loadSavedKeybindings(),
  isSettingsOpen: false,
  recordingId: null,

  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false, recordingId: null }),

  setRecordingId: (id) => set({ recordingId: id }),

  updateKeybinding: (id, bindingUpdates) => {
    const current = get().keybindings;
    const existing = current[id];
    if (!existing) return;

    const updated = {
      ...current,
      [id]: { ...existing, ...bindingUpdates },
    };

    set({ keybindings: updated, recordingId: null });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  },

  resetKeybindings: () => {
    set({ keybindings: { ...DEFAULT_KEYBINDINGS }, recordingId: null });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  },
}));

/** Helper to format keybinding object as human-readable string */
export function formatShortcut(kb: Keybinding): string {
  const parts: string[] = [];
  if (kb.ctrl) parts.push('Ctrl');
  if (kb.shift) parts.push('Shift');
  if (kb.alt) parts.push('Alt');

  let keyDisplay = kb.key;
  if (keyDisplay === ' ') keyDisplay = 'Space';
  else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase();

  parts.push(keyDisplay);
  return parts.join('+');
}
