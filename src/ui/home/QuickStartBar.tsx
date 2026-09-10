import { useRef } from 'react';
import { useProjectStore } from '@store/projectStore';
import { loadCordsBoxFromFile } from '@graph/circuitSerializer';
import { Button } from '../common/Button';
import { Plus, Volume2, Upload, Sparkles } from 'lucide-react';

export function QuickStartBar() {
  const startBlankProject = useProjectStore((s) => s.startBlankProject);
  const startProjectFromTemplate = useProjectStore((s) => s.startProjectFromTemplate);
  const navigateTo = useProjectStore((s) => s.navigateTo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await loadCordsBoxFromFile(file);
    if (res.valid && res.project) {
      useProjectStore.getState().updateProjectMetadata({
        title: res.project.metadata.title,
        description: res.project.metadata.description,
        templateOriginId: res.project.metadata.templateOriginId,
      });
      navigateTo('editor');
    } else {
      alert(`Could not import file:\n${res.errors.join('\n')}`);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 20px',
        borderRadius: '10px',
        backgroundColor: 'rgba(24, 24, 27, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".cdx,.cordsbox,.cords,.json"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* Left: Workbench summary & version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(217, 119, 6, 0.12)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            color: '#f59e0b',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={12} />
          WDF Engine v2.0
        </span>
        <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
          Real-time Wave Digital Filter passive circuit physics, tone stacks & digital waveguide
          synthesis.
        </div>
      </div>

      {/* Right: 3 Concise Quick-Start Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Button
          variant="primary"
          onClick={() =>
            startProjectFromTemplate('guitar_sound_test_template', 'Stratocaster HSS Bench')
          }
          style={{
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#dc2626',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          <Volume2 size={14} />
          <span>Launch HSS Bench</span>
        </Button>

        <Button
          variant="secondary"
          onClick={startBlankProject}
          style={{
            padding: '7px 13px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#f4f4f5',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          <span>Blank Canvas</span>
        </Button>

        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '7px 13px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#f4f4f5',
            cursor: 'pointer',
          }}
        >
          <Upload size={14} />
          <span>Import .cdx</span>
        </Button>
      </div>
    </div>
  );
}
