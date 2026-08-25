import { useState, useEffect } from 'react';
import { loadCordsBoxFromFile } from '@graph/circuitSerializer';
import { useProjectStore } from '@store/projectStore';
import { UploadCloud } from 'lucide-react';

export function FileDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const navigateTo = useProjectStore((s) => s.navigateTo);

  useEffect(() => {
    let dragCounter = 0;

    function handleDragEnter(e: DragEvent) {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    }

    function handleDragLeave(e: DragEvent) {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
        dragCounter = 0;
      }
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }

    async function handleDrop(e: DragEvent) {
      e.preventDefault();
      setIsDragging(false);
      dragCounter = 0;

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (
        !file.name.endsWith('.cdx') &&
        !file.name.endsWith('.cordsbox') &&
        !file.name.endsWith('.cords') &&
        !file.name.endsWith('.json')
      ) {
        return;
      }

      const res = await loadCordsBoxFromFile(file);
      if (res.valid && res.project) {
        useProjectStore.getState().updateProjectMetadata({
          title: res.project.metadata.title,
          description: res.project.metadata.description,
          templateOriginId: res.project.metadata.templateOriginId,
        });
        navigateTo('editor');
      } else {
        alert(`Failed to import .cdx project:\n${res.errors.join('\n')}`);
      }
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [navigateTo]);

  if (!isDragging) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(18, 18, 20, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '3px dashed #dc2626',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        color: '#ffffff',
        pointerEvents: 'none',
      }}
    >
      <UploadCloud size={52} color="#dc2626" />
      <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.3px' }}>
        Drop .cdx File to Open Project
      </div>
      <div style={{ fontSize: '13px', color: '#a1a1aa' }}>
        1:1 project netlist, component placement, pot tapers, and audio DSP settings will be loaded.
      </div>
    </div>
  );
}
