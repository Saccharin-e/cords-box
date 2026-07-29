/**
 * Circuit Linter (FR-5)
 *
 * Validates circuit graphs for:
 * - Dead shorts to ground (direct and transitive)
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
  diagnostics.push(...detectSamePoleJumpers(graph));
  return diagnostics;
}

/** Detect dead shorts to ground (FR-5) */
function detectDeadShorts(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const nodes = graph.getNodes();
  const groundNodes = nodes.filter((n) => n.type === 'ground' || n.role === 'ground');
  const hotNodes = nodes.filter((n) => n.role === 'hot' && n.signalState === 'active');

  for (const hot of hotNodes) {
    for (const ground of groundNodes) {
      if (hot.id === ground.id) continue;

      // Direct edge check
      const directEdges = graph.getEdgesBetween(hot.id, ground.id);
      if (directEdges.length > 0) {
        diagnostics.push({
          severity: 'error',
          code: 'DEAD_SHORT',
          message: `Dead short: "${hot.id}" is directly connected to ground "${ground.id}"`,
          nodeIds: [hot.id, ground.id],
        });
        continue;
      }

      // Transitive path check without load
      if (graph.hasPath(hot.id, ground.id)) {
        diagnostics.push({
          severity: 'error',
          code: 'TRANSITIVE_SHORT',
          message: `Path short: Signal node "${hot.id}" has an unresisted path to ground "${ground.id}"`,
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
    (n) => n.role === 'hot' && n.signalState === 'active',
  );
  const outputTips = nodes.filter((n) => n.type === 'jack_terminal' || n.role === 'tip');

  if (outputTips.length === 0 && pickupHots.length > 0) {
    diagnostics.push({
      severity: 'error',
      code: 'NO_OUTPUT',
      message: 'No output jack terminal found in the circuit',
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
        message: `Active signal terminal "${pickup.id}" has no connected path to output`,
        nodeIds: [pickup.id],
      });
    }
  }
  return diagnostics;
}

/** Detect same-pole jumper chain violations (FR-5) */
function detectSamePoleJumpers(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const components = graph.getComponents();

  for (const comp of components) {
    if (comp.type.startsWith('switch_')) {
      const nodes = graph.getComponentNodes(comp.id);
      
      // Group lugs by pole
      const poleGroups: Map<string, string[]> = new Map();
      for (const node of nodes) {
        const text = node.role || node.id;
        if (text.toLowerCase().includes('pole')) {
          const poleMatch = text.match(/(Pole\s+[A-D])/i);
          const poleKey = poleMatch ? poleMatch[1] : 'Pole A';
          if (!poleGroups.has(poleKey)) {
            poleGroups.set(poleKey, []);
          }
          poleGroups.get(poleKey)!.push(node.id);
        }
      }

      for (const [poleName, lugIds] of poleGroups.entries()) {
        for (let i = 0; i < lugIds.length; i++) {
          for (let j = i + 1; j < lugIds.length; j++) {
            const edges = graph.getEdgesBetween(lugIds[i], lugIds[j]);
            if (edges.length > 0) {
              diagnostics.push({
                severity: 'warning',
                code: 'SAME_POLE_JUMPER',
                message: `Redundant jumper detected between ${lugIds[i]} and ${lugIds[j]} on ${poleName} of "${comp.label}"`,
                nodeIds: [lugIds[i], lugIds[j]],
              });
            }
          }
        }
      }
    }
  }

  return diagnostics;
}
