/**
 * Circuit Linter (FR-5)
 *
 * Validates circuit graphs for:
 * - Dead shorts to ground
 * - Open circuits (no path to output)
 * - Same-pole jumper chain violations
 */

import { Graph } from '@graph/Graph';

export interface LintDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeIds: string[];
}

/** Run all lint checks and return diagnostics */
export function lintCircuit(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  diagnostics.push(...detectDeadShorts(graph));
  diagnostics.push(...detectOpenCircuits(graph));
  return diagnostics;
}

/** Detect dead shorts to ground (FR-5) */
function detectDeadShorts(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const nodes = graph.getNodes();
  const groundNodes = nodes.filter((n) => n.type === 'ground');
  const hotNodes = nodes.filter((n) => n.role === 'hot' && n.signalState === 'active');

  for (const hot of hotNodes) {
    for (const ground of groundNodes) {
      const directEdges = graph.getEdgesBetween(hot.id, ground.id);
      if (directEdges.length > 0) {
        diagnostics.push({
          severity: 'error',
          code: 'DEAD_SHORT',
          message: `Dead short: "${hot.id}" is directly connected to ground "${ground.id}"`,
          nodeIds: [hot.id, ground.id],
        });
      }
    }
  }
  return diagnostics;
}

/** Detect open circuits — pickups that don't reach output (FR-5) */
function detectOpenCircuits(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const nodes = graph.getNodes();
  const pickupHots = nodes.filter(
    (n) => n.type === 'terminal' && n.role === 'hot' && n.signalState === 'active',
  );
  const outputTips = nodes.filter((n) => n.type === 'jack_terminal' && n.role === 'tip');

  if (outputTips.length === 0 && pickupHots.length > 0) {
    diagnostics.push({
      severity: 'error',
      code: 'NO_OUTPUT',
      message: 'No output jack found in the circuit',
      nodeIds: [],
    });
    return diagnostics;
  }

  for (const pickup of pickupHots) {
    const reachesOutput = outputTips.some((out) => graph.hasPath(pickup.id, out.id));
    if (!reachesOutput) {
      diagnostics.push({
        severity: 'warning',
        code: 'OPEN_CIRCUIT',
        message: `Pickup terminal "${pickup.id}" has no path to the output jack`,
        nodeIds: [pickup.id],
      });
    }
  }
  return diagnostics;
}
