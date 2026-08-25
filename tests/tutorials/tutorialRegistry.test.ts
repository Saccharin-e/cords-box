import { describe, it, expect } from 'vitest';
import { TUTORIAL_LESSONS } from '@tutorials/tutorialRegistry';
import { DOC_ARTICLES } from '@docs/docsRegistry';
import { useProjectStore } from '@store/projectStore';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';

describe('Tutorials, Docs & Project Store', () => {
  it('should define structured interactive tutorial lessons', () => {
    expect(TUTORIAL_LESSONS.length).toBeGreaterThanOrEqual(4);

    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.id).toBeDefined();
      expect(lesson.title.length).toBeGreaterThan(5);
      expect(lesson.steps.length).toBeGreaterThan(0);
      expect(lesson.durationMinutes).toBeGreaterThan(0);

      for (const step of lesson.steps) {
        expect(step.id).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.instruction.length).toBeGreaterThan(10);
        expect(step.explanation.length).toBeGreaterThan(10);
      }
    }
  });

  it('should define comprehensive documentation articles across all categories', () => {
    expect(DOC_ARTICLES.length).toBeGreaterThanOrEqual(4);

    const categories = new Set(DOC_ARTICLES.map((a) => a.category));
    expect(categories.has('Hardware & Circuits')).toBe(true);
    expect(categories.has('WDF DSP Physics')).toBe(true);
    expect(categories.has('Audio & Tab Player')).toBe(true);
    expect(categories.has('CAD Shortcuts')).toBe(true);

    for (const doc of DOC_ARTICLES) {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeDefined();
      expect(doc.summary.length).toBeGreaterThan(5);
      expect(doc.contentMarkdown.length).toBeGreaterThan(50);
      expect(doc.tags.length).toBeGreaterThan(0);
    }
  });

  it('should handle project creation, template linking, and view navigation in projectStore', () => {
    const store = useProjectStore.getState();

    // 1. Navigation
    store.navigateTo('editor');
    expect(useProjectStore.getState().currentView).toBe('editor');

    store.navigateTo('home');
    expect(useProjectStore.getState().currentView).toBe('home');

    // 2. Start from template
    store.startProjectFromTemplate('guitar_sound_test_template', 'Custom HSS Strat');
    expect(useProjectStore.getState().currentView).toBe('editor');
    expect(useProjectStore.getState().activeProject?.title).toBe('Custom HSS Strat');
    expect(useProjectStore.getState().activeProject?.templateOriginId).toBe('guitar_sound_test_template');
    expect(useCanvasStore.getState().instances.length).toBeGreaterThan(0);
    expect(useCircuitStore.getState().graph.getComponents().length).toBeGreaterThan(0);

    // 3. Start blank project
    store.startBlankProject();
    expect(useProjectStore.getState().currentView).toBe('editor');
    expect(useProjectStore.getState().activeProject?.templateOriginId).toBeUndefined();
    expect(useCanvasStore.getState().instances.length).toBe(0);
    expect(useCircuitStore.getState().graph.getComponents().length).toBe(0);

    // 4. Update metadata
    useProjectStore.getState().updateProjectMetadata({ title: 'My Custom Tele' });
    expect(useProjectStore.getState().activeProject?.title).toBe('My Custom Tele');

    // 5. Interactive Tutorial workflow
    store.startTutorial('tutorial_wiring_101');
    expect(useProjectStore.getState().activeTutorialId).toBe('tutorial_wiring_101');
    expect(useProjectStore.getState().activeTutorialStep).toBe(0);

    store.setTutorialStep(2);
    expect(useProjectStore.getState().activeTutorialStep).toBe(2);

    store.exitTutorial();
    expect(useProjectStore.getState().activeTutorialId).toBeNull();
  });
});
