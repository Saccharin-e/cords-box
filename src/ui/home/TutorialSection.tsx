import { TUTORIAL_LESSONS } from '@tutorials/tutorialRegistry';
import { useProjectStore } from '@store/projectStore';
import { loadPresetById } from '@presets/presetLibrary';
import { Button } from '../common/Button';
import { Clock, Play } from 'lucide-react';

export function TutorialSection() {
  const startTutorial = useProjectStore((s) => s.startTutorial);

  function handleLaunchTutorial(lessonId: string, templateStarterId?: string) {
    if (templateStarterId) {
      loadPresetById(templateStarterId);
    }
    startTutorial(lessonId);
  }

  const difficultyColors: Record<string, string> = {
    Beginner: '#16a34a',
    Intermediate: '#0284c7',
    Advanced: '#d97706',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#f4f4f5' }}>
          Interactive Wiring Tutorials
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#a1a1aa' }}>
          Hands-on guided walkthroughs that load starter circuits into the studio workbench with live step verification.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {TUTORIAL_LESSONS.map((lesson) => {
          const diffColor = difficultyColors[lesson.difficulty] || '#0284c7';

          return (
            <div
              key={lesson.id}
              style={{
                borderRadius: '10px',
                backgroundColor: 'rgba(24, 24, 27, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(0, 0, 0, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      backgroundColor: `${diffColor}20`,
                      color: diffColor,
                      letterSpacing: '0.4px',
                    }}
                  >
                    {lesson.difficulty}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#71717a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Clock size={12} />
                    <span>{lesson.durationMinutes} mins · {lesson.steps.length} steps</span>
                  </span>
                </div>

                <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: '#f4f4f5' }}>
                  {lesson.title}
                </h3>

                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
                  {lesson.subtitle}
                </h4>

                <p style={{ margin: '0 0 12px 0', fontSize: '12px', lineHeight: 1.5, color: '#a1a1aa' }}>
                  {lesson.description}
                </p>

                {/* Tag Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {lesson.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        color: '#71717a',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                variant="primary"
                onClick={() => handleLaunchTutorial(lesson.id, lesson.templateStarterId)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '5px',
                  backgroundColor: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Play size={13} fill="currentColor" />
                <span>Launch Interactive Tutorial</span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
