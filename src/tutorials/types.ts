/**
 * types.ts — Interactive Tutorial Catalog Type Definitions
 */

export type TutorialDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface TutorialStep {
  id: string;
  stepNumber: number;
  title: string;
  instruction: string;
  explanation: string;
  tip?: string;
  targetComponentType?: string;
  highlightCoordinates?: { x: number; y: number };
  verificationRule?: {
    type: 'has_component' | 'has_connection' | 'has_pot_value' | 'has_switch_wired';
    componentType?: string;
    sourceType?: string;
    targetType?: string;
  };
}

export interface TutorialLesson {
  id: string;
  title: string;
  subtitle: string;
  difficulty: TutorialDifficulty;
  durationMinutes: number;
  iconName: string;
  description: string;
  tags: string[];
  templateStarterId?: string; // Initial preset loaded into canvas when tutorial starts
  steps: TutorialStep[];
}
