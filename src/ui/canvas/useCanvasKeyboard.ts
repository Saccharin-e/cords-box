/**
 * useCanvasKeyboard — Global keyboard shortcut listener for CAD operations.
 */

import { useEffect } from 'react';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';

export function useCanvasKeyboard() {
  const {
    copySelected,
    pasteSelected,
    duplicateSelected,
    selectAll,
    rotateSelected,
    flipSelectedH,
    flipSelectedV,
    groupSelected,
    ungroupSelected,
    removeSelected,
    toggleSnapToGrid,
    nudgeSelected,
    undo,
    redo,
    selectedId,
  } = useCanvasStore();

  const { selectedEdgeId, removeEdge } = useCircuitStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore key events when typing inside text inputs/textareas
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl + C: Copy
      if (ctrlOrCmd && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelected();
        return;
      }

      // Ctrl + V: Paste
      if (ctrlOrCmd && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSelected();
        return;
      }

      // Ctrl + D: Duplicate
      if (ctrlOrCmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // Ctrl + A: Select All
      if (ctrlOrCmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      // Ctrl + Z: Undo / Ctrl + Y: Redo
      if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl + G: Group / Ctrl + Shift + G: Ungroup
      if (ctrlOrCmd && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }

      // Shift + S: Toggle Snap-to-Grid
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleSnapToGrid();
        return;
      }

      // R: Rotate 90° CW / Shift + R: Rotate 90° CCW
      if (!ctrlOrCmd && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        rotateSelected(e.shiftKey ? -90 : 90);
        return;
      }

      // H: Flip Horizontal
      if (!ctrlOrCmd && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        flipSelectedH();
        return;
      }

      // V: Flip Vertical
      if (!ctrlOrCmd && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        flipSelectedV();
        return;
      }

      // Delete / Backspace: Delete selected components or wires
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedEdgeId) {
          removeEdge(selectedEdgeId);
        } else {
          removeSelected();
        }
        return;
      }

      // Nudge with Arrow Keys
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
    copySelected,
    pasteSelected,
    duplicateSelected,
    selectAll,
    rotateSelected,
    flipSelectedH,
    flipSelectedV,
    groupSelected,
    ungroupSelected,
    removeSelected,
    toggleSnapToGrid,
    nudgeSelected,
    undo,
    redo,
    selectedId,
    selectedEdgeId,
    removeEdge,
  ]);
}
