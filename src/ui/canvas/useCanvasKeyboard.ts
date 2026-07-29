/**
 * useCanvasKeyboard — Dynamic, customizable keyboard shortcut listener for CAD operations.
 * Evaluates key events against configurable keybindings stored in useKeybindingsStore.
 */

import { useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { useKeybindingsStore, type Keybinding } from '@store/keybindingsStore';

function matchesKeybinding(e: KeyboardEvent, kb?: Keybinding): boolean {
  if (!kb) return false;

  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;
  const alt = e.altKey;

  const reqCtrl = Boolean(kb.ctrl);
  const reqShift = Boolean(kb.shift);
  const reqAlt = Boolean(kb.alt);

  if (ctrl !== reqCtrl || shift !== reqShift || alt !== reqAlt) {
    return false;
  }

  let eventKey = e.key;
  if (eventKey === ' ') eventKey = 'Space';

  return eventKey.toLowerCase() === kb.key.toLowerCase();
}

export function useCanvasKeyboard() {
  const {
    copySelected,
    pasteSelected,
    duplicateSelected,
    selectAll,
    clearSelection,
    cancelWiring,
    rotateSelected,
    flipSelectedH,
    flipSelectedV,
    groupSelected,
    ungroupSelected,
    removeSelected,
    toggleSnapToGrid,
    toggleShowComponentLabels,
    toggleWiringMode,
    toggleExportModal,
    nudgeSelected,
    undo,
    redo,
  } = useCanvasStore();

  const { selectedEdgeId, removeEdge } = useCircuitStore();
  const { keybindings, openSettings, recordingId } = useKeybindingsStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Do not process application shortcuts while recording a new keybinding
      if (recordingId) return;

      // Ignore key events when typing inside text inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // ── Open Settings & Shortcuts Modal ──
      if (matchesKeybinding(e, keybindings.openSettings)) {
        e.preventDefault();
        openSettings();
        return;
      }

      // ── Undo / Redo ──
      if (matchesKeybinding(e, keybindings.undo)) {
        e.preventDefault();
        undo();
        return;
      }
      if (matchesKeybinding(e, keybindings.redo)) {
        e.preventDefault();
        redo();
        return;
      }

      // ── Editing Operations ──
      if (matchesKeybinding(e, keybindings.copy)) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (matchesKeybinding(e, keybindings.paste)) {
        e.preventDefault();
        pasteSelected();
        return;
      }
      if (matchesKeybinding(e, keybindings.duplicate)) {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (matchesKeybinding(e, keybindings.selectAll)) {
        e.preventDefault();
        selectAll();
        return;
      }
      if (matchesKeybinding(e, keybindings.deselect)) {
        e.preventDefault();
        cancelWiring();
        clearSelection();
        return;
      }
      if (matchesKeybinding(e, keybindings.delete) || e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
        } else {
          removeSelected();
        }
        return;
      }

      // ── Transforms ──
      if (matchesKeybinding(e, keybindings.rotateCw)) {
        e.preventDefault();
        rotateSelected(90);
        return;
      }
      if (matchesKeybinding(e, keybindings.rotateCcw)) {
        e.preventDefault();
        rotateSelected(-90);
        return;
      }
      if (matchesKeybinding(e, keybindings.flipH)) {
        e.preventDefault();
        flipSelectedH();
        return;
      }
      if (matchesKeybinding(e, keybindings.flipV)) {
        e.preventDefault();
        flipSelectedV();
        return;
      }
      if (matchesKeybinding(e, keybindings.group)) {
        e.preventDefault();
        groupSelected();
        return;
      }
      if (matchesKeybinding(e, keybindings.ungroup)) {
        e.preventDefault();
        ungroupSelected();
        return;
      }

      // ── View & Canvas Toggles ──
      if (matchesKeybinding(e, keybindings.snapGrid)) {
        e.preventDefault();
        toggleSnapToGrid();
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleLabels)) {
        e.preventDefault();
        toggleShowComponentLabels();
        return;
      }
      if (matchesKeybinding(e, keybindings.toggleWiring)) {
        e.preventDefault();
        toggleWiringMode();
        return;
      }
      if (matchesKeybinding(e, keybindings.exportCanvas)) {
        e.preventDefault();
        toggleExportModal();
        return;
      }

      // ── Arrow Key Nudge ──
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelected(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelected(0, step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelected(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelected(step, 0);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    keybindings,
    recordingId,
    openSettings,
    copySelected,
    pasteSelected,
    duplicateSelected,
    selectAll,
    clearSelection,
    cancelWiring,
    rotateSelected,
    flipSelectedH,
    flipSelectedV,
    groupSelected,
    ungroupSelected,
    removeSelected,
    toggleSnapToGrid,
    toggleShowComponentLabels,
    toggleWiringMode,
    toggleExportModal,
    nudgeSelected,
    undo,
    redo,
    selectedEdgeId,
    removeEdge,
  ]);
}
