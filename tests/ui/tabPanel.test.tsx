import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tabScheduler } from '../../src/audio/tab/tabScheduler';
import { TabPanel } from '../../src/ui/tab/TabPanel';

const LABELED_SIX_EIGHT_TAB = `Time: 6/8
[Verse]
e|0-------|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|

[Chorus]
e|3-------|
B|--------|
G|--------|
D|--------|
A|--------|
E|--------|`;

describe('TabPanel sections', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders parsed section labels and jumps using signature-aware measure starts', async () => {
    const seekSpy = vi.spyOn(tabScheduler, 'seek');
    const view = render(<TabPanel />);

    fireEvent.click(view.getByText(/edit tab text/i));
    fireEvent.change(view.getByPlaceholderText(/paste 6-line ascii guitar tab/i), {
      target: { value: LABELED_SIX_EIGHT_TAB },
    });

    const jumpControl = await view.findByLabelText('Jump to section');
    expect(view.getByText('Verse')).toBeInTheDocument();
    expect(view.getByText('Chorus')).toBeInTheDocument();

    fireEvent.change(jumpControl, { target: { value: '1' } });
    await waitFor(() => expect(seekSpy).toHaveBeenCalledWith(3));
  });
});
