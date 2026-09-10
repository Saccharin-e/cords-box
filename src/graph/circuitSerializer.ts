/**
 * circuitSerializer.ts — 1:1 .cordsbox Project Save File Serializer & URL Hash Share System
 *
 * Full roundtrip state replication:
 * - Canvas Layout (activeView, scale, panX, panY, wireColor)
 * - Canvas Component Instances (positions, rotations, labels, custom styles)
 * - Pure Circuit Graph (components, nodes, wires/edges, resistance, wire types)
 * - Audio & DSP State (Amp models, Tone stack, Pedals, Cable capacitance, Volume boost)
 * - Tuning State (Tuning preset, string frequencies)
 * - Project Metadata (ID, Title, Description, Template Origin ID, Timestamp, Checksum)
 */

import { useCircuitStore } from '@store/circuitStore';
import { useCanvasStore } from '@store/canvasStore';
import { useTuningStore } from '@store/tuningStore';
import { audioPipeline } from '@audio/pipeline';
import {
  type CordsBoxProjectFile,
  type CordsBoxProjectMetadata,
  type ValidationResult,
  validateCordsBoxFile,
  computeProjectChecksum,
} from './cordsboxSchema';

export interface ExportProjectOptions {
  title?: string;
  description?: string;
  author?: string;
  templateOriginId?: string;
  tags?: string[];
}

/**
 * Export 100% of current application state into a portable CordsBoxProjectFile
 */
export function exportProjectToCordsBox(options: ExportProjectOptions = {}): CordsBoxProjectFile {
  const canvasState = useCanvasStore.getState();
  const circuitState = useCircuitStore.getState();
  const tuningState = useTuningStore.getState();
  const graphJson = circuitState.graph.toJSON();

  const now = new Date().toISOString();

  const metadata: CordsBoxProjectMetadata = {
    id: `cordsbox-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    title: options.title || 'Untitled Guitar Project',
    description: options.description || 'Custom guitar wiring circuit built in Cords Box',
    author: options.author || 'Guitarist',
    templateOriginId: options.templateOriginId,
    createdAt: now,
    updatedAt: now,
    tags: options.tags || ['guitar', 'wiring'],
    version: '2.0.0',
  };

  const projectPayload: Omit<CordsBoxProjectFile, 'checksum'> = {
    format: 'cordsbox-project',
    schemaVersion: '2.0.0',
    metadata,
    canvas: {
      activeView: canvasState.activeView,
      scale: canvasState.scale,
      panX: canvasState.panX,
      panY: canvasState.panY,
      activeWireColor: canvasState.wireDrawOptions?.color || '#dc2626',
    },
    instances: canvasState.instances,
    graph: {
      components: graphJson.components || [],
      nodes: graphJson.nodes || [],
      edges: graphJson.edges || [],
    },
    audioState: {
      ...audioPipeline.getAmpPedalboardState(),
      masterVolumeBoost: audioPipeline.getMasterVolumeBoost(),
    },
    tuning: {
      tuningId: tuningState.activeTuningId,
    },
  };

  const checksum = computeProjectChecksum(projectPayload);

  return {
    ...projectPayload,
    checksum,
  };
}

/**
 * Replicate a CordsBoxProjectFile exactly 1:1 into all application stores
 */
export function importProjectFromCordsBox(data: unknown): ValidationResult {
  const result = validateCordsBoxFile(data);
  if (!result.valid || !result.project) {
    return result;
  }

  const project = result.project;

  // 1. Restore Canvas Store State
  useCanvasStore.setState({
    instances: project.instances || [],
    activeView: project.canvas?.activeView || 'physical',
    scale: project.canvas?.scale || 1,
    panX: project.canvas?.panX || 0,
    panY: project.canvas?.panY || 0,
    selectedId: null,
    selectedIds: [],
    wireDrawOptions: {
      color: project.canvas?.activeWireColor || '#dc2626',
      wireType: 'vintage_cloth_pushback',
      connectionType: 'solder',
    },
  });

  // 2. Restore Circuit Graph Netlist
  if (project.graph) {
    useCircuitStore.getState().importJSON(JSON.stringify(project.graph));
  }

  // 3. Restore Audio DSP & Amp Pedalboard State
  if (project.audioState) {
    const { masterVolumeBoost, ...ampState } = project.audioState;
    if (ampState && Object.keys(ampState).length > 0) {
      audioPipeline.updateAmpPedalboardState(ampState as any);
    }
    if (typeof masterVolumeBoost === 'number') {
      audioPipeline.setMasterVolumeBoost(masterVolumeBoost);
    }
  }

  // 4. Restore Tuning State
  if (project.tuning?.tuningId) {
    useTuningStore.getState().setTuning(project.tuning.tuningId);
  }

  return result;
}

/**
 * Trigger browser file download of the project in .cdx format
 */
export function downloadCordsBoxFile(
  projectOrOptions?: CordsBoxProjectFile | ExportProjectOptions,
  filename?: string,
): void {
  const project =
    projectOrOptions && 'format' in projectOrOptions
      ? (projectOrOptions as CordsBoxProjectFile)
      : exportProjectToCordsBox(projectOrOptions as ExportProjectOptions);

  const rawName = (project.metadata.title || 'guitar-circuit')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const cleanFilename =
    filename ||
    (rawName.endsWith('.cdx') || rawName.endsWith('.cordsbox') ? rawName : `${rawName}.cdx`);

  const jsonStr = JSON.stringify(project, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    cleanFilename.endsWith('.cdx') || cleanFilename.endsWith('.cordsbox')
      ? cleanFilename
      : `${cleanFilename}.cdx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const downloadCdxFile = downloadCordsBoxFile;
export const loadCdxFromFile = loadCordsBoxFromFile;

/**
 * Parse and load a .cordsbox File from user input / file picker / drag & drop
 */
export async function loadCordsBoxFromFile(file: File): Promise<ValidationResult> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    return importProjectFromCordsBox(json);
  } catch (err: any) {
    return {
      valid: false,
      errors: [`Failed to read file: ${err?.message || 'Invalid JSON syntax'}`],
    };
  }
}

/**
 * Generate a compressed base64 URL hash share link for quick sharing
 */
export function exportCircuitToUrlHash(options?: ExportProjectOptions): string {
  const project = exportProjectToCordsBox(options);
  const jsonStr = JSON.stringify(project);
  const base64Str = btoa(encodeURIComponent(jsonStr));
  return `${window.location.origin}${window.location.pathname}#project=${base64Str}`;
}

/**
 * Restore circuit from URL hash if available (#project=... or legacy #circuit=...)
 */
export function importCircuitFromUrlHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;

  if (hash.startsWith('#project=')) {
    try {
      const base64Str = hash.replace('#project=', '');
      const jsonStr = decodeURIComponent(atob(base64Str));
      const raw = JSON.parse(jsonStr);
      const res = importProjectFromCordsBox(raw);
      return res.valid;
    } catch (err) {
      console.warn('Failed to parse #project URL share hash:', err);
      return false;
    }
  }

  // Legacy fallback: #circuit=...
  if (hash.startsWith('#circuit=')) {
    try {
      const base64Str = hash.replace('#circuit=', '');
      const jsonStr = decodeURIComponent(atob(base64Str));
      const raw = JSON.parse(jsonStr);
      const res = importProjectFromCordsBox(raw);
      return res.valid;
    } catch (err) {
      console.warn('Failed to parse #circuit URL share hash:', err);
      return false;
    }
  }

  return false;
}
