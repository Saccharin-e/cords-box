/**
 * Truth Table Export (FR-7)
 *
 * Generates human-readable truth tables for switch configurations.
 */

import { Graph } from '@graph/Graph';
import type { SwitchConnectivityMap } from '@graph/switch';
import { getActiveConnections } from '@graph/switch';

export interface TruthTableRow {
  position: number;
  connections: { source: string; target: string }[];
  description: string;
}

export interface TruthTable {
  switchId: string;
  rows: TruthTableRow[];
}

/** Generate a truth table for a switch component */
export function generateTruthTable(
  _graph: Graph,
  switchId: string,
  connectivityMap: SwitchConnectivityMap,
): TruthTable {
  const rows: TruthTableRow[] = [];

  for (const posStr of Object.keys(connectivityMap)) {
    const position = Number(posStr);
    const connections = getActiveConnections(connectivityMap, position);

    rows.push({
      position,
      connections: connections.map((c) => ({
        source: c.sourceLug,
        target: c.targetLug,
      })),
      description: `Position ${position}: ${connections.length} connection(s)`,
    });
  }

  return { switchId, rows };
}

/** Format a truth table as a human-readable string */
export function formatTruthTable(table: TruthTable): string {
  const lines: string[] = [];
  lines.push(`Truth Table for ${table.switchId}`);
  lines.push('='.repeat(50));

  for (const row of table.rows) {
    lines.push(`\nPosition ${row.position}:`);
    if (row.connections.length === 0) {
      lines.push('  (no connections)');
    } else {
      for (const conn of row.connections) {
        lines.push(`  ${conn.source} ──── ${conn.target}`);
      }
    }
  }

  return lines.join('\n');
}
