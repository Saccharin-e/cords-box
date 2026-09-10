import { useProjectStore } from '@store/projectStore';
import { TUTORIAL_LESSONS } from '@tutorials/tutorialRegistry';
import { Button } from '../common/Button';
import { GraduationCap, Lightbulb, ChevronLeft, ChevronRight, CheckCircle, X } from 'lucide-react';

export function TutorialGuideOverlay() {
  const activeTutorialId = useProjectStore((s) => s.activeTutorialId);
  const activeTutorialStep = useProjectStore((s) => s.activeTutorialStep);
  const setTutorialStep = useProjectStore((s) => s.setTutorialStep);
  const exitTutorial = useProjectStore((s) => s.exitTutorial);

  if (!activeTutorialId) return null;

  const lesson = TUTORIAL_LESSONS.find((l) => l.id === activeTutorialId);
  if (!lesson) return null;

  const currentStep = lesson.steps[activeTutorialStep] || lesson.steps[0];
  const isFirstStep = activeTutorialStep === 0;
  const isLastStep = activeTutorialStep >= lesson.steps.length - 1;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: '90%',
        maxWidth: '720px',
        borderRadius: '10px',
        backgroundColor: 'rgba(20, 20, 24, 0.96)',
        border: '1px solid rgba(2, 132, 199, 0.4)',
        boxShadow: '0 16px 36px -8px rgba(0, 0, 0, 0.8), 0 0 20px rgba(2, 132, 199, 0.2)',
        padding: '16px 20px',
        backdropFilter: 'blur(16px)',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <GraduationCap size={16} color="#38bdf8" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8' }}>
            {lesson.title}
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              padding: '1px 6px',
              borderRadius: '4px',
            }}
          >
            Step {activeTutorialStep + 1} of {lesson.steps.length}
          </span>
        </div>

        <button
          onClick={exitTutorial}
          title="Exit Tutorial Mode"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Step Title & Instruction */}
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
          {currentStep.title}
        </div>
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.4 }}>
          {currentStep.instruction}
        </div>
      </div>

      {/* Explanation & Tip */}
      <div
        style={{
          fontSize: '12px',
          color: '#94a3b8',
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
          <Lightbulb size={13} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong style={{ color: '#e2e8f0' }}>Why:</strong> {currentStep.explanation}
          </span>
        </div>
        {currentStep.tip && (
          <div style={{ color: '#d97706', paddingLeft: '19px' }}>
            <strong>Tip:</strong> {currentStep.tip}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '4px',
        }}
      >
        <Button
          variant="secondary"
          onClick={() => setTutorialStep(Math.max(0, activeTutorialStep - 1))}
          disabled={isFirstStep}
          style={{
            padding: '5px 10px',
            fontSize: '12px',
            borderRadius: '5px',
            opacity: isFirstStep ? 0.4 : 1,
            cursor: isFirstStep ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ChevronLeft size={13} />
          <span>Previous</span>
        </Button>

        <div style={{ display: 'flex', gap: '4px' }}>
          {lesson.steps.map((s, idx) => (
            <div
              key={s.id}
              onClick={() => setTutorialStep(idx)}
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor:
                  idx === activeTutorialStep
                    ? '#38bdf8'
                    : idx < activeTutorialStep
                      ? '#16a34a'
                      : 'rgba(255, 255, 255, 0.2)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            />
          ))}
        </div>

        {isLastStep ? (
          <Button
            variant="primary"
            onClick={exitTutorial}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#16a34a',
              border: 'none',
              borderRadius: '5px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <CheckCircle size={13} />
            <span>Finish Tutorial</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => setTutorialStep(activeTutorialStep + 1)}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '5px',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>Next</span>
            <ChevronRight size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}
