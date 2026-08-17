import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PlayableFretboardPanel } from '../../src/ui/toolbar/PlayableFretboardPanel';

describe('PlayableFretboardPanel Moveable Behavior', () => {
  it('renders the moveable guitar fretboard panel with drag header', () => {
    const { container, getByTitle, getByText } = render(<PlayableFretboardPanel />);

    const panel = container.querySelector('.playable-fretboard-panel');
    expect(panel).toBeTruthy();
    expect(getByText('Fretboard')).toBeInTheDocument();

    const header = getByTitle('Click and drag header to move fretboard panel');
    expect(header).toBeInTheDocument();
    expect(header.style.cursor).toBe('grab');
  });

  it('updates transform position when header is dragged via pointer events', () => {
    const { container, getByTitle } = render(<PlayableFretboardPanel />);

    const panel = container.querySelector('.playable-fretboard-panel') as HTMLElement;
    const header = getByTitle('Click and drag header to move fretboard panel');

    expect(panel.style.transform).toBe('translate(calc(-50% + 0px), 0px)');

    // Simulate pointer down to start drag
    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 });
    expect(header.style.cursor).toBe('grabbing');

    // Simulate pointer move
    fireEvent.pointerMove(header, { clientX: 150, clientY: 180, pointerId: 1 });
    expect(panel.style.transform).toBe('translate(calc(-50% + 50px), 80px)');

    // Simulate pointer up to end drag
    fireEvent.pointerUp(header, { pointerId: 1 });
    expect(header.style.cursor).toBe('grab');
  });

  it('manages active floating panel focus state in store', async () => {
    const { useCanvasStore } = await import('../../src/store/canvasStore');

    expect(useCanvasStore.getState().activeFloatingPanel).toBeNull();

    useCanvasStore.getState().toggleFretboard();
    expect(useCanvasStore.getState().isFretboardOpen).toBe(true);
    expect(useCanvasStore.getState().activeFloatingPanel).toBe('fretboard');

    useCanvasStore.getState().toggleAmpPanel();
    expect(useCanvasStore.getState().isAmpPanelOpen).toBe(true);
    expect(useCanvasStore.getState().activeFloatingPanel).toBe('amp');

    useCanvasStore.getState().setActiveFloatingPanel('fretboard');
    expect(useCanvasStore.getState().activeFloatingPanel).toBe('fretboard');
  });
});
