import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HomePage } from '../../src/ui/home/HomePage';
import { useProjectStore } from '../../src/store/projectStore';

describe('HomePage Navbar and Layout', () => {
  it('renders top navbar brand, tab switcher, and launch workbench button', () => {
    const { getByText } = render(<HomePage />);

    expect(getByText('Cords Box')).toBeInTheDocument();
    expect(getByText('v2.0')).toBeInTheDocument();
    expect(getByText('Projects & Templates')).toBeInTheDocument();
    expect(getByText('Tutorials')).toBeInTheDocument();
    expect(getByText('Documentation')).toBeInTheDocument();
    expect(getByText('Open Studio Workbench')).toBeInTheDocument();
  });

  it('switches tabs between templates, tutorials, and documentation', () => {
    const { getByText, queryByText } = render(<HomePage />);

    // Initially in templates tab
    expect(getByText('Starter Wiring Templates')).toBeInTheDocument();

    // Switch to Tutorials tab
    fireEvent.click(getByText('Tutorials'));
    expect(getByText('Interactive Wiring Tutorials')).toBeInTheDocument();
    expect(queryByText('Starter Wiring Templates')).toBeNull();

    // Switch to Documentation tab
    fireEvent.click(getByText('Documentation'));
    expect(getByText('Documentation Hub')).toBeInTheDocument();

    // Switch back to Templates tab
    fireEvent.click(getByText('Projects & Templates'));
    expect(getByText('Starter Wiring Templates')).toBeInTheDocument();
  });

  it('navigates to editor when clicking Open Studio Workbench', () => {
    const { getByText } = render(<HomePage />);
    useProjectStore.getState().navigateTo('home');

    fireEvent.click(getByText('Open Studio Workbench'));
    expect(useProjectStore.getState().currentView).toBe('editor');
  });
});
