import { useSlotStore } from '@store/slotStore';
import { useProjectStore } from '@store/projectStore';
import { downloadCordsBoxFile } from '@graph/circuitSerializer';
import { Button } from '../common/Button';
import { Download, RotateCcw, FolderOpen } from 'lucide-react';

export function RecentProjects() {
  const slots = useSlotStore((s) => s.slots);
  const loadSlot = useSlotStore((s) => s.loadSlot);
  const resetSlotToDefault = useSlotStore((s) => s.resetSlotToDefault);
  const navigateTo = useProjectStore((s) => s.navigateTo);

  function handleOpenSlot(slotId: string, name: string) {
    const success = loadSlot(slotId);
    if (success) {
      useProjectStore.getState().updateProjectMetadata({
        id: slotId,
        title: name,
      });
      navigateTo('editor');
    }
  }

  function handleDownloadSlot(slotId: string, name: string) {
    loadSlot(slotId);
    downloadCordsBoxFile({ title: name });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: 700, color: '#f4f4f5' }}>
          Saved Workspace Slots
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>
          Quick-load stored layout slots or download as portable .cdx files.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '10px',
        }}
      >
        {slots.map((slot) => {
          const compCount = slot.data?.components?.length || 0;
          const edgeCount = slot.data?.edges?.length || 0;
          const dateStr = new Date(slot.updatedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={slot.slotId}
              style={{
                borderRadius: '8px',
                backgroundColor: 'rgba(24, 24, 27, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      color: slot.isCustom ? '#38bdf8' : '#71717a',
                      backgroundColor: slot.isCustom
                        ? 'rgba(56, 189, 248, 0.1)'
                        : 'rgba(255, 255, 255, 0.04)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {slot.isCustom ? 'Custom' : 'Slot'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#71717a' }}>{dateStr}</span>
                </div>

                <h4
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#f4f4f5',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={slot.name}
                >
                  {slot.name}
                </h4>

                <div style={{ fontSize: '11px', color: '#71717a' }}>
                  {compCount} components · {edgeCount} wires
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Button
                  variant="primary"
                  onClick={() => handleOpenSlot(slot.slotId, slot.name)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    backgroundColor: '#27272a',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <FolderOpen size={12} />
                  <span>Open</span>
                </Button>

                <Button
                  variant="secondary"
                  title="Export .cdx file"
                  onClick={() => handleDownloadSlot(slot.slotId, slot.name)}
                  style={{
                    padding: '5px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Download size={12} />
                </Button>

                {slot.isCustom && (
                  <Button
                    variant="secondary"
                    title="Reset slot to default template"
                    onClick={() => {
                      if (confirm(`Reset "${slot.name}" to factory default?`)) {
                        resetSlotToDefault(slot.slotId);
                      }
                    }}
                    style={{
                      padding: '5px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RotateCcw size={12} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
