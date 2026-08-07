/**
 * circuitSerializer.ts — Compact Base64 URL Share Hash & .cordsbox File Envelope Serializer
 */

import { useCircuitStore } from '@store/circuitStore';
import { useCanvasStore } from '@store/canvasStore';
import { audioPipeline } from '@audio/pipeline';

export interface CordsBoxEnvelope {
  version: '1.0.0';
  timestamp: string;
  instances: unknown[];
  graphData: unknown;
  ampPedalState: unknown;
}

export function exportCircuitToEnvelope(): CordsBoxEnvelope {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    instances: useCanvasStore.getState().instances,
    graphData: useCircuitStore.getState().graph.toJSON(),
    ampPedalState: audioPipeline.getAmpPedalboardState(),
  };
}

export function importCircuitFromEnvelope(envelope: CordsBoxEnvelope): void {
  if (!envelope || !envelope.instances) return;
  useCanvasStore.setState({ instances: envelope.instances as any });
  if (envelope.graphData) {
    const jsonStr = typeof envelope.graphData === 'string' ? envelope.graphData : JSON.stringify(envelope.graphData);
    useCircuitStore.getState().importJSON(jsonStr);
  }
  if (envelope.ampPedalState) {
    audioPipeline.updateAmpPedalboardState(envelope.ampPedalState as any);
  }
}

export function exportCircuitToUrlHash(): string {
  const envelope = exportCircuitToEnvelope();
  const jsonStr = JSON.stringify(envelope);
  const base64Str = btoa(encodeURIComponent(jsonStr));
  return `${window.location.origin}${window.location.pathname}#circuit=${base64Str}`;
}

export function importCircuitFromUrlHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash.startsWith('#circuit=')) return false;

  try {
    const base64Str = hash.replace('#circuit=', '');
    const jsonStr = decodeURIComponent(atob(base64Str));
    const envelope = JSON.parse(jsonStr) as CordsBoxEnvelope;
    importCircuitFromEnvelope(envelope);
    return true;
  } catch (err) {
    console.warn('Failed to parse circuit URL share hash:', err);
    return false;
  }
}

export function downloadCordsBoxFile(filename = 'guitar-circuit.cordsbox'): void {
  const envelope = exportCircuitToEnvelope();
  const jsonStr = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
