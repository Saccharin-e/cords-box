/**
 * ExportModal — High-Fidelity PNG & PDF Export Dialog with Custom Canvas Crop Region.
 */

import { useState } from 'react';
import jsPDF from 'jspdf';
import { useCanvasStore } from '@store/canvasStore';

export function ExportModal() {
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const isExportModalOpen = useCanvasStore((s) => s.isExportModalOpen);
  const toggleExportModal = useCanvasStore((s) => s.toggleExportModal);
  const exportBox = useCanvasStore((s) => s.exportBox);
  const showExportBox = useCanvasStore((s) => s.showExportBox);
  const setExportBox = useCanvasStore((s) => s.setExportBox);
  const toggleShowExportBox = useCanvasStore((s) => s.toggleShowExportBox);
  const recalculateAutoExportBox = useCanvasStore((s) => s.recalculateAutoExportBox);

  if (!isExportModalOpen) return null;

  async function handleExport() {
    // 1. Locate active Konva Stage container
    const stageEl = document.querySelector('.canvas-area canvas') as HTMLCanvasElement | null;
    if (!stageEl) {
      alert('Canvas stage not ready for export.');
      return;
    }

    // Temporarily hide export overlay lines for clean snapshot
    const wasShowingBox = showExportBox;
    if (wasShowingBox) {
      useCanvasStore.setState({ showExportBox: false });
      // Allow React state & Konva layer to flush
      await new Promise((r) => setTimeout(r, 50));
    }

    try {
      const { x, y, width, height } = exportBox;

      // Create a temporary canvas for cropped high-res rendering
      const scaleFactor = 2; // 2x High-DPI output
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width * scaleFactor;
      tempCanvas.height = height * scaleFactor;
      const ctx = tempCanvas.getContext('2d');

      if (ctx) {
        ctx.scale(scaleFactor, scaleFactor);
        // Draw cropped section from main stage canvas
        ctx.drawImage(
          stageEl,
          x, y, width, height, // Source crop rect
          0, 0, width, height  // Destination rect
        );
      }

      const filename = `cords-box-circuit-${Date.now()}`;

      if (format === 'png') {
        const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
      } else {
        // PDF Export using jsPDF
        const orientation = width >= height ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
        });

        const dataUrl = tempCanvas.toDataURL('image/png', 1.0);
        pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
        pdf.save(`${filename}.pdf`);
      }
    } finally {
      if (wasShowingBox) {
        useCanvasStore.setState({ showExportBox: true });
      }
      toggleExportModal();
    }
  }

  return (
    <div style={overlayStyle} onClick={toggleExportModal}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📥</span>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.05em' }}>EXPORT CIRCUIT DESIGN</span>
          </div>
          <button onClick={toggleExportModal} style={closeBtnStyle}>✕</button>
        </div>

        {/* Format Selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Export Format</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <button
              onClick={() => setFormat('png')}
              style={{
                ...formatBtnStyle,
                ...(format === 'png' ? activeFormatBtnStyle : {}),
              }}
            >
              <span style={{ fontSize: 18 }}>📷</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>PNG Image</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>2x HD Raster Image</div>
              </div>
            </button>

            <button
              onClick={() => setFormat('pdf')}
              style={{
                ...formatBtnStyle,
                ...(format === 'pdf' ? activeFormatBtnStyle : {}),
              }}
            >
              <span style={{ fontSize: 18 }}>📄</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>PDF Document</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Print-Ready Vector PDF</div>
              </div>
            </button>
          </div>
        </div>

        {/* Export Area & Bounding Box Size Controls */}
        <div style={sectionBoxStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <label style={labelStyle}>Export Region Bounds</label>
            <button onClick={recalculateAutoExportBox} style={secondaryBtnStyle}>
              🎯 Auto-Fit Rectangular Bounds
            </button>
          </div>

          {/* Canvas Box Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Width</span>
              <span style={statValueStyle}>{exportBox.width} px</span>
            </div>
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Height</span>
              <span style={statValueStyle}>{exportBox.height} px</span>
            </div>
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Offset X</span>
              <span style={statValueStyle}>{exportBox.x} px</span>
            </div>
            <div style={statBoxStyle}>
              <span style={statLabelStyle}>Offset Y</span>
              <span style={statValueStyle}>{exportBox.y} px</span>
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#a1a1aa' }}>Aspect Ratio Preset</span>
            <select
              value={exportBox.aspectRatio}
              onChange={(e) => {
                setExportBox({ aspectRatio: e.target.value as any });
                recalculateAutoExportBox();
              }}
              style={selectStyle}
            >
              <option value="auto">Auto Fit (Rectangular)</option>
              <option value="1:1">1:1 Square</option>
              <option value="16:9">16:9 Widescreen</option>
              <option value="4:3">4:3 Standard</option>
              <option value="a4">A4 Landscape</option>
            </select>
          </div>

          {/* Margin / Padding Slider */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>
              <span>Adequate Canvas Padding</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{exportBox.padding ?? 60} px</span>
            </div>
            <input
              type="range"
              min="20"
              max="150"
              value={exportBox.padding ?? 60}
              onChange={(e) => {
                setExportBox({ padding: Number(e.target.value) });
                recalculateAutoExportBox();
              }}
              style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Checkbox: Show Overlay Bounds Line on Canvas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0' }}>
          <input
            type="checkbox"
            id="show-export-box"
            checked={showExportBox}
            onChange={toggleShowExportBox}
            style={{ width: 16, height: 16, accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <label htmlFor="show-export-box" style={{ fontSize: 12, color: '#e4e4e7', cursor: 'pointer' }}>
            Show line indicating export box on canvas
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={toggleExportModal} style={cancelBtnStyle}>
            Cancel
          </button>
          <button onClick={handleExport} style={exportActionBtnStyle}>
            {format === 'png' ? '💾 Export PNG' : '📄 Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Styles ──────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(8px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  width: 480,
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 16,
  padding: 24,
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  color: '#e4e4e7',
  fontFamily: "'Inter', sans-serif",
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: 12,
  marginBottom: 16,
  borderBottom: '1px solid #27272a',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#a1a1aa',
  fontSize: 16,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#a1a1aa',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const formatBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 10,
  color: '#a1a1aa',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};

const activeFormatBtnStyle: React.CSSProperties = {
  backgroundColor: 'rgba(56, 189, 248, 0.12)',
  borderColor: '#38bdf8',
  color: '#38bdf8',
};

const sectionBoxStyle: React.CSSProperties = {
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 12,
  padding: 14,
  marginTop: 12,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  backgroundColor: '#3f3f46',
  border: '1px solid #52525b',
  borderRadius: 6,
  color: '#e4e4e7',
  fontSize: 11,
  cursor: 'pointer',
};

const statBoxStyle: React.CSSProperties = {
  backgroundColor: '#18181b',
  borderRadius: 6,
  padding: '6px 8px',
  display: 'flex',
  flexDirection: 'column',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 9,
  color: '#71717a',
  textTransform: 'uppercase',
};

const statValueStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#38bdf8',
  fontFamily: 'monospace',
};

const selectStyle: React.CSSProperties = {
  backgroundColor: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  color: '#e4e4e7',
  padding: '4px 8px',
  fontSize: 12,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#27272a',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#a1a1aa',
  fontWeight: 600,
  cursor: 'pointer',
};

const exportActionBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  backgroundColor: '#0284c7',
  border: 'none',
  borderRadius: 8,
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
};
