/**
 * WiringDiagnosticsPanel.tsx — Dedicated Space-Efficient Wiring Diagnostics Panel
 *
 * Positioned under the Value Inspector in the right sidebar.
 * Features:
 * - Collapsible & adjustable split height
 * - Real-time circuit graph linting (FR-5)
 * - Space-efficient compact diagnostic items with severity badges (ERROR, WARNING, INFO)
 * - 1-click node selection / highlighting
 */

import { useState } from 'react';
import { useCircuitStore } from '@store/circuitStore';
import { useCanvasStore } from '@store/canvasStore';
import type { LintDiagnostic } from '@lint/linter';

export function WiringDiagnosticsPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const selectInstance = useCanvasStore((s) => s.selectInstance);
  const instances = useCanvasStore((s) => s.instances);

  const diagnostics: LintDiagnostic[] = useCircuitStore((s) => s.diagnostics);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  function handleHighlightNodes(nodeIds: string[]) {
    if (!nodeIds || nodeIds.length === 0) return;
    const targetNodeId = nodeIds[0];
    const matchingInst = instances.find(
      (inst) => inst.id === targetNodeId || targetNodeId.startsWith(inst.id),
    );
    if (matchingInst) {
      selectInstance(matchingInst.id);
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#121318',
        border: '1px solid #27272a',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Panel Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          backgroundColor: '#18181b',
          borderBottom: isCollapsed ? 'none' : '1px solid #27272a',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={errorCount > 0 ? '#ef4444' : warningCount > 0 ? '#f59e0b' : '#22c55e'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f4f4f5' }}>
            Wiring Diagnostics
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {errorCount === 0 && warningCount === 0 ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              Verified Clean
            </span>
          ) : (
            <>
              {errorCount > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 4,
                    backgroundColor: '#7f1d1d',
                    color: '#fca5a5',
                  }}
                >
                  {errorCount} {errorCount === 1 ? 'Error' : 'Errors'}
                </span>
              )}
              {warningCount > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: 4,
                    backgroundColor: '#78350f',
                    color: '#fef3c7',
                  }}
                >
                  {warningCount} {warningCount === 1 ? 'Warn' : 'Warns'}
                </span>
              )}
            </>
          )}

          <span style={{ fontSize: 10, color: '#71717a', marginLeft: 4 }}>
            {isCollapsed ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Diagnostics List Container */}
      {!isCollapsed && (
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {diagnostics.length === 0 ? (
            <div
              style={{
                padding: '10px 8px',
                fontSize: 11,
                color: '#4ade80',
                textAlign: 'center',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderRadius: 6,
                border: '1px dashed rgba(34, 197, 94, 0.2)',
              }}
            >
              ✓ No circuit defects or wiring short-circuits detected.
            </div>
          ) : (
            <div
              style={{
                maxHeight: 180,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {diagnostics.map((diag, index) => {
                const isError = diag.severity === 'error';
                return (
                  <div
                    key={index}
                    onClick={() => handleHighlightNodes(diag.nodeIds)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      backgroundColor: isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      border: isError ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      transition: 'background-color 0.15s ease',
                    }}
                    title="Click to highlight affected component"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: 3,
                          backgroundColor: isError ? '#ef4444' : '#f59e0b',
                          color: '#ffffff',
                          textTransform: 'uppercase',
                        }}
                      >
                        {diag.code}
                      </span>
                      <span style={{ fontSize: 9, color: '#a1a1aa' }}>Click to select</span>
                    </div>

                    <div style={{ fontSize: 11, color: isError ? '#fca5a5' : '#fef3c7', lineHeight: 1.3 }}>
                      {diag.message}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
