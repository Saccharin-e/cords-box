/**
 * projectStore.ts — Project Lifecycle, View Routing & Template Linking Store (Zustand)
 *
 * Manages:
 * - App view mode: 'home' (Home Dashboard) vs 'editor' (Studio Workbench)
 * - Current project metadata (title, author, template origin link)
 * - Active interactive tutorial tracking
 * - Project creation from templates or blank canvas
 */

import { create } from 'zustand';
import { useCanvasStore } from './canvasStore';
import { useCircuitStore } from './circuitStore';
import { useSlotStore } from './slotStore';
import { loadPresetById } from '@presets/presetLibrary';
import { exportProjectToCordsBox } from '@graph/circuitSerializer';
import type { CordsBoxProjectMetadata } from '@graph/cordsboxSchema';

export type AppView = 'home' | 'editor';

interface ProjectState {
  currentView: AppView;
  activeProject: CordsBoxProjectMetadata | null;
  activeTutorialId: string | null;
  activeTutorialStep: number;

  // Navigation
  navigateTo: (view: AppView) => void;

  // Project Creation & Lifecycle
  startProjectFromTemplate: (templateId: string, templateTitle?: string) => void;
  startBlankProject: () => void;
  updateProjectMetadata: (updates: Partial<CordsBoxProjectMetadata>) => void;
  saveActiveProjectToSlot: (slotId?: string) => string;
  loadProjectFromSlot: (slotId: string) => boolean;

  // Interactive Tutorials
  startTutorial: (tutorialId: string) => void;
  setTutorialStep: (step: number) => void;
  exitTutorial: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentView: 'home',
  activeProject: {
    id: `project-${Date.now()}`,
    title: 'Stratocaster HSS Bench',
    description: 'Vintage Stratocaster with bridge humbucker test circuit',
    templateOriginId: 'guitar_sound_test_template',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '2.0.0',
    tags: ['strat', 'template'],
  },
  activeTutorialId: null,
  activeTutorialStep: 0,

  navigateTo: (view: AppView) => {
    set({ currentView: view });
  },

  startProjectFromTemplate: (templateId: string, templateTitle?: string) => {
    // 1. Reset current canvas & graph
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();

    // 2. Load the template preset netlist and canvas instances
    loadPresetById(templateId);

    const now = new Date().toISOString();
    const metadata: CordsBoxProjectMetadata = {
      id: `project-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title:
        templateTitle ||
        `Custom ${templateId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`,
      description: `Project initialized from ${templateId} template`,
      templateOriginId: templateId,
      createdAt: now,
      updatedAt: now,
      version: '2.0.0',
      tags: ['template', templateId],
    };

    set({
      currentView: 'editor',
      activeProject: metadata,
      activeTutorialId: null,
      activeTutorialStep: 0,
    });
  },

  startBlankProject: () => {
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();

    const now = new Date().toISOString();
    const metadata: CordsBoxProjectMetadata = {
      id: `project-${Date.now()}`,
      title: 'Untitled Circuit',
      description: 'Clean blank wiring project',
      createdAt: now,
      updatedAt: now,
      version: '2.0.0',
      tags: ['blank', 'custom'],
    };

    set({
      currentView: 'editor',
      activeProject: metadata,
      activeTutorialId: null,
      activeTutorialStep: 0,
    });
  },

  updateProjectMetadata: (updates: Partial<CordsBoxProjectMetadata>) => {
    set((state) => ({
      activeProject: state.activeProject
        ? {
            ...state.activeProject,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : null,
    }));
  },

  saveActiveProjectToSlot: (slotId?: string) => {
    const state = get();
    const targetSlotId = slotId || useSlotStore.getState().activeSlotId || 'slot_1';
    const project = exportProjectToCordsBox({
      title: state.activeProject?.title,
      description: state.activeProject?.description,
      templateOriginId: state.activeProject?.templateOriginId,
    });

    const slotStore = useSlotStore.getState();
    slotStore.saveCurrentToSlot(targetSlotId, project.metadata.title);

    set((s) => ({
      activeProject: s.activeProject
        ? { ...s.activeProject, updatedAt: new Date().toISOString() }
        : null,
    }));

    return targetSlotId;
  },

  loadProjectFromSlot: (slotId: string) => {
    const slotStore = useSlotStore.getState();
    const slot = slotStore.slots.find((s) => s.slotId === slotId);
    if (!slot) return false;

    const res = slotStore.loadSlot(slotId);
    if (res) {
      set({
        currentView: 'editor',
        activeProject: {
          id: slot.slotId,
          title: slot.name,
          description: '',
          createdAt: new Date(slot.updatedAt).toISOString(),
          updatedAt: new Date(slot.updatedAt).toISOString(),
          version: '2.0.0',
        },
      });
      return true;
    }
    return false;
  },

  startTutorial: (tutorialId: string) => {
    set({
      currentView: 'editor',
      activeTutorialId: tutorialId,
      activeTutorialStep: 0,
    });
  },

  setTutorialStep: (step: number) => {
    set({ activeTutorialStep: step });
  },

  exitTutorial: () => {
    set({ activeTutorialId: null, activeTutorialStep: 0 });
  },
}));
