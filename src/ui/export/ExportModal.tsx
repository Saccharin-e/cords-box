/**
 * ExportModal — High-Fidelity PNG & PDF Export Dialog with Custom Canvas Crop Region.
 */

import { useState } from 'react';
import jsPDF from 'jspdf';
import { useCanvasStore } from '@store/canvasStore';
import { Button } from '../common/Button';
import { Slider } from '../common/Slider';
import { X } from 'lucide-react';

export function ExportModal() {
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const isExportModalOpen = useCanvasStore((s) => s.isExportModalOpen);
  const toggleExportModal = useCanvasStore((s) => s.toggleExportModal);
  const exportBox = useCanvasStore((s) => s.exportBox);
  const showExportBox = useCanvasStore((s) => s.showExportBox);
  const setExportBox = useCanvasStore((s) => s.setExportBox);
  const toggleShowExportBox = useCanvasStore((s) => s.toggleShowExportBox);
  const recalculateAutoExportBox = useCanvasStore((s) => s.recalculateAutoExportBox);

  const [localPadding, setLocalPadding] = useState(exportBox.padding ?? 60);

  if (!isExportModalOpen) return null;

  async function handleExport() {
    // 1. Locate all layer canvas elements inside active Konva Stage container
    const canvasEls = Array.from(
      document.querySelectorAll<HTMLCanvasElement>(
        '.canvas-area .konvajs-content canvas, .canvas-area canvas',
      ),
    );
    if (canvasEls.length === 0) {
      setError('Canvas stage not ready for export.');
      return;
    }
    setError(null);

    // Temporarily hide export overlay lines for clean snapshot
    const wasShowingBox = showExportBox;
    if (wasShowingBox) {
      useCanvasStore.setState({ showExportBox: false });
      // Allow React state & Konva layer to flush
      await new Promise((r) => setTimeout(r, 60));
    }

    try {
      const state = useCanvasStore.getState();
      const scale = state.scale;
      const panX = state.panX;
      const panY = state.panY;

      const { x, y, width, height } = exportBox;

      // Crop region in Stage screen pixels
      const srcX = Math.round(x * scale + panX);
      const srcY = Math.round(y * scale + panY);
      const srcW = Math.round(width * scale);
      const srcH = Math.round(height * scale);

      // Scale factor for output image clarity (High-DPI 2x)
      const scaleFactor = 2;
      const outW = Math.round(width * scaleFactor);
      const outH = Math.round(height * scaleFactor);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = outW;
      tempCanvas.height = outH;
      const ctx = tempCanvas.getContext('2d');

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Composite every Konva layer canvas (Background, Components, Wires, Cards) sequentially
        for (const layerCanvas of canvasEls) {
          const layerW = layerCanvas.width;
          const layerH = layerCanvas.height;

          const clipX = Math.max(0, srcX);
          const clipY = Math.max(0, srcY);
          const clipRight = Math.min(layerW, srcX + srcW);
          const clipBottom = Math.min(layerH, srcY + srcH);

          const clipW = clipRight - clipX;
          const clipH = clipBottom - clipY;

          if (clipW > 0 && clipH > 0) {
            const destX = Math.round(((clipX - srcX) / srcW) * outW);
            const destY = Math.round(((clipY - srcY) / srcH) * outH);
            const destW = Math.round((clipW / srcW) * outW);
            const destH = Math.round((clipH / srcH) * outH);

            ctx.drawImage(layerCanvas, clipX, clipY, clipW, clipH, destX, destY, destW, destH);
          }
        }
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
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.05em' }}>
              EXPORT CIRCUIT DESIGN
            </span>
          </div>
          <Button
            variant="icon"
            aria-label="Close"
            onClick={toggleExportModal}
            style={closeBtnStyle}
          >
            <X size={14} />
          </Button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              padding: '8px 12px',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Format Selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Export Format</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <Button
              variant="ghost"
              onClick={() => setFormat('png')}
              style={{
                ...formatBtnStyle,
                ...(format === 'png' ? activeFormatBtnStyle : {}),
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>PNG Image</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>2x HD Raster Image</div>
              </div>
            </Button>

            <Button
              variant="ghost"
              onClick={() => setFormat('pdf')}
              style={{
                ...formatBtnStyle,
                ...(format === 'pdf' ? activeFormatBtnStyle : {}),
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700 }}>PDF Document</div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Print-Ready Vector PDF</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Export Area & Bounding Box Size Controls */}
        <div style={sectionBoxStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <label style={labelStyle}>Export Region Bounds</label>
            <Button
              variant="secondary"
              onClick={recalculateAutoExportBox}
              style={{ ...secondaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              Auto-Fit Rectangular Bounds
            </Button>
          </div>

          {/* Canvas Box Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 8,
              marginBottom: 12,
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
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
          <Slider
            label="Adequate Canvas Padding"
            value={localPadding}
            min={20}
            max={150}
            unit="px"
            accentColor="#38bdf8"
            onChange={(val) => {
              setLocalPadding(val);
              setExportBox({ padding: val });
              recalculateAutoExportBox();
            }}
          />
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
          <label
            htmlFor="show-export-box"
            style={{ fontSize: 12, color: '#e4e4e7', cursor: 'pointer' }}
          >
            Show line indicating export box on canvas
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <Button variant="secondary" onClick={toggleExportModal} style={cancelBtnStyle}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleExport} style={exportActionBtnStyle}>
            {format === 'png' ? 'Export PNG' : 'Export PDF'}
          </Button>
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
