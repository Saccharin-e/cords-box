/**
 * cordsboxSchema.ts — Specification & Validator for .cordsbox Portable Save Files (v2.0)
 *
 * Encapsulates the complete 1:1 workspace state:
 * - Canvas Layout (activeView, scale, panX, panY, wireColor)
 * - Canvas Component Instances (positions, rotations, labels, custom styles)
 * - Pure Circuit Graph (components, nodes, wires/edges, resistance, wire types)
 * - Audio & DSP State (Amp models, Tone stack, Pedals, Cable capacitance, Volume boost)
 * - Tuning State (Tuning preset, string frequencies)
 * - Project Metadata (ID, Title, Description, Template Origin ID, Timestamp, Checksum)
 */

import type { CanvasComponentInstance, ViewMode } from '@store/canvasStore';
import type { Component, CircuitEdge, CircuitNode } from './types';
import type { AmpPedalboardState } from '@audio/pipeline';

export interface CordsBoxProjectMetadata {
  id: string;
  title: string;
  description: string;
  author?: string;
  templateOriginId?: string; // Links project to its starter template preset (e.g. 'strat_hss')
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  version: string;
}

export interface CordsBoxCanvasState {
  activeView: ViewMode;
  scale: number;
  panX: number;
  panY: number;
  activeWireColor?: string;
}

export interface CordsBoxTuningState {
  tuningId: string;
  openFrequencies?: number[];
}

export interface CordsBoxProjectFile {
  format: 'cordsbox-project';
  schemaVersion: '2.0.0';
  metadata: CordsBoxProjectMetadata;
  canvas: CordsBoxCanvasState;
  instances: CanvasComponentInstance[];
  graph: {
    components: Component[];
    nodes: CircuitNode[];
    edges: CircuitEdge[];
  };
  audioState: AmpPedalboardState & {
    masterVolumeBoost?: number;
  };
  tuning: CordsBoxTuningState;
  checksum?: string;
}

/** Legacy v1.0 Envelope for backwards compatibility */
export interface LegacyCordsBoxEnvelope {
  version: '1.0.0';
  timestamp: string;
  instances: CanvasComponentInstance[];
  graphData: unknown;
  ampPedalState?: unknown;
}

/**
 * Compute a simple DJB2/CRC-like hex checksum for file integrity verification
 */
export function computeProjectChecksum(payload: Omit<CordsBoxProjectFile, 'checksum'>): string {
  const json = JSON.stringify(payload);
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) ^ json.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  project?: CordsBoxProjectFile;
  isLegacy?: boolean;
}

/**
 * Validate and optionally migrate any JSON object to a valid CordsBoxProjectFile
 */
export function validateCordsBoxFile(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['File content is not a valid JSON object.'] };
  }

  const obj = raw as Record<string, any>;

  // Check for v2.0 format
  if (obj.format === 'cordsbox-project') {
    const errors: string[] = [];

    if (!obj.metadata || typeof obj.metadata.title !== 'string') {
      errors.push('Missing or invalid project metadata title.');
    }
    if (!Array.isArray(obj.instances)) {
      errors.push('Missing or invalid canvas component instances array.');
    }
    if (!obj.graph || !Array.isArray(obj.graph.components) || !Array.isArray(obj.graph.edges)) {
      errors.push('Missing or invalid circuit graph netlist.');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const project = obj as CordsBoxProjectFile;

    // Verify checksum if present
    if (project.checksum) {
      const { checksum, ...rest } = project;
      const expectedChecksum = computeProjectChecksum(rest);
      if (checksum !== expectedChecksum) {
        console.warn(`[CordsBox] Checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
      }
    }

    return { valid: true, errors: [], project, isLegacy: false };
  }

  // Check for legacy v1.0 envelope migration
  if (obj.version === '1.0.0' && Array.isArray(obj.instances)) {
    const legacy = obj as LegacyCordsBoxEnvelope;
    const migrated: CordsBoxProjectFile = {
      format: 'cordsbox-project',
      schemaVersion: '2.0.0',
      metadata: {
        id: `legacy-${Date.now()}`,
        title: 'Imported Circuit Project',
        description: 'Migrated from Cords Box v1.0 format',
        createdAt: legacy.timestamp || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      canvas: {
        activeView: 'physical',
        scale: 1,
        panX: 0,
        panY: 0,
      },
      instances: legacy.instances,
      graph: {
        components: (legacy.graphData as any)?.components || [],
        nodes: (legacy.graphData as any)?.nodes || [],
        edges: (legacy.graphData as any)?.edges || [],
      },
      audioState: (legacy.ampPedalState as any) || {},
      tuning: {
        tuningId: 'standard_e',
      },
    };

    return { valid: true, errors: [], project: migrated, isLegacy: true };
  }

  return {
    valid: false,
    errors: ['Unrecognized file format. Expected a .cordsbox project file.'],
  };
}
