import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/store/canvasStore';

describe('CanvasStore View Transitions & Panel Auto-Hiding', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      activeView: 'physical',
      isSidebarOpen: true,
      isInspectorOpen: true,
      isControlsOpen: true,
      isTestPanelOpen: false,
      isAmpPanelOpen: false,
      isFretboardOpen: false,
      isTabPanelOpen: false,
      savedPanelsBeforeSoundSystem: null,
    });
  });

  it('hides library, CAD, and inspector when switching to sound_systems mode and saves prior state', () => {
    expect(useCanvasStore.getState().isSidebarOpen).toBe(true);
    expect(useCanvasStore.getState().isInspectorOpen).toBe(true);
    expect(useCanvasStore.getState().isControlsOpen).toBe(true);

    useCanvasStore.getState().setActiveView('sound_systems');

    expect(useCanvasStore.getState().activeView).toBe('sound_systems');
    expect(useCanvasStore.getState().isSidebarOpen).toBe(false);
    expect(useCanvasStore.getState().isInspectorOpen).toBe(false);
    expect(useCanvasStore.getState().isControlsOpen).toBe(false);
    expect(useCanvasStore.getState().savedPanelsBeforeSoundSystem).toEqual({
      isSidebarOpen: true,
      isInspectorOpen: true,
      isControlsOpen: true,
    });
  });

  it('restores library, CAD, and inspector when switching back to physical view', () => {
    useCanvasStore.setState({
      isSidebarOpen: true,
      isInspectorOpen: false,
      isControlsOpen: true,
    });

    useCanvasStore.getState().setActiveView('sound_systems');
    expect(useCanvasStore.getState().isSidebarOpen).toBe(false);
    expect(useCanvasStore.getState().isInspectorOpen).toBe(false);
    expect(useCanvasStore.getState().isControlsOpen).toBe(false);

    useCanvasStore.getState().setActiveView('physical');
    expect(useCanvasStore.getState().activeView).toBe('physical');
    expect(useCanvasStore.getState().isSidebarOpen).toBe(true);
    expect(useCanvasStore.getState().isInspectorOpen).toBe(false);
    expect(useCanvasStore.getState().isControlsOpen).toBe(true);
    expect(useCanvasStore.getState().savedPanelsBeforeSoundSystem).toBeNull();
  });

  it('automatically opens physical view and restores panels when toggleSidebar is called in sound_systems mode', () => {
    useCanvasStore.setState({
      isSidebarOpen: true,
      isInspectorOpen: true,
      isControlsOpen: false,
    });

    useCanvasStore.getState().setActiveView('sound_systems');
    expect(useCanvasStore.getState().activeView).toBe('sound_systems');

    useCanvasStore.getState().toggleSidebar();
    expect(useCanvasStore.getState().activeView).toBe('physical');
    expect(useCanvasStore.getState().isSidebarOpen).toBe(true);
    expect(useCanvasStore.getState().isInspectorOpen).toBe(true);
    expect(useCanvasStore.getState().isControlsOpen).toBe(false);
  });
});
