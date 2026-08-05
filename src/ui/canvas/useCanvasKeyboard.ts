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
  const copySelected = useCanvasStore((s) => s.copySelected);
  const pasteSelected = useCanvasStore((s) => s.pasteSelected);
  const duplicateSelected = useCanvasStore((s) => s.duplicateSelected);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const clearSelection = useCanvasStore((s) => s.clearSelection);
  const cancelWiring = useCanvasStore((s) => s.cancelWiring);
  const rotateSelected = useCanvasStore((s) => s.rotateSelected);
  const flipSelectedH = useCanvasStore((s) => s.flipSelectedH);
  const flipSelectedV = useCanvasStore((s) => s.flipSelectedV);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const removeSelected = useCanvasStore((s) => s.removeSelected);
  const toggleSnapToGrid = useCanvasStore((s) => s.toggleSnapToGrid);
  const toggleShowComponentLabels = useCanvasStore((s) => s.toggleShowComponentLabels);
  const toggleWiringMode = useCanvasStore((s) => s.toggleWiringMode);
  const toggleExportModal = useCanvasStore((s) => s.toggleExportModal);
  const nudgeSelected = useCanvasStore((s) => s.nudgeSelected);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);

  const selectedEdgeId = useCircuitStore((s) => s.selectedEdgeId);
  const removeEdge = useCircuitStore((s) => s.removeEdge);
  const keybindings = useKeybindingsStore((s) => s.keybindings);
  const openSettings = useKeybindingsStore((s) => s.openSettings);
  const recordingId = useKeybindingsStore((s) => s.recordingId);

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
      if (matchesKeybinding(e, keybindings.toggleFullscreen)) {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
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
