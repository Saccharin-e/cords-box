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

/** Detect dead shorts to ground (FR-5) — direct and transitive */
function detectDeadShorts(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const nodes = graph.getNodes();
  const edges = graph.getEdges();
  const groundNodes = nodes.filter((n) => n.type === 'ground' || n.role === 'ground');
  const hotNodes = nodes.filter((n) => n.role === 'hot' && n.signalState === 'active');
  const groundIds = new Set(groundNodes.map((n) => n.id));

  // Build a low-resistance adjacency list (resistance < 1Ω) excluding
  // edges whose endpoints belong to pickup components (legitimate ~6kΩ).
  const pickupCompTypes = new Set([
    'pickup_single_coil',
    'pickup_humbucker',
    'pickup_p90',
  ]);
  const pickupNodeIds = new Set<string>();
  for (const comp of graph.getComponents()) {
    if (pickupCompTypes.has(comp.type)) {
      for (const n of graph.getComponentNodes(comp.id)) {
        pickupNodeIds.add(n.id);
      }
    }
  }

  const lowRAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.resistance >= 1) continue;
    // Skip edges that connect pickup internals (hot↔ground within a pickup)
    if (pickupNodeIds.has(edge.source) && pickupNodeIds.has(edge.target)) continue;
    if (!lowRAdjacency.has(edge.source)) lowRAdjacency.set(edge.source, []);
    if (!lowRAdjacency.has(edge.target)) lowRAdjacency.set(edge.target, []);
    lowRAdjacency.get(edge.source)!.push(edge.target);
    lowRAdjacency.get(edge.target)!.push(edge.source);
  }

  for (const hot of hotNodes) {
    for (const ground of groundNodes) {
      if (hot.id === ground.id) continue;

      // Direct edge check (unresisted wire short directly connecting hot signal to ground)
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

    // Transitive check: BFS from hot through low-resistance edges only.
    // If we reach any ground node, flag TRANSITIVE_DEAD_SHORT.
    const visited = new Set<string>();
    const queue = [hot.id];
    visited.add(hot.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current !== hot.id && groundIds.has(current)) {
        // Only flag if not already caught as a direct short
        const alreadyDirect = diagnostics.some(
          (d) =>
            d.code === 'DEAD_SHORT' &&
            d.nodeIds.includes(hot.id) &&
            d.nodeIds.includes(current),
        );
        if (!alreadyDirect) {
          diagnostics.push({
            severity: 'error',
            code: 'TRANSITIVE_DEAD_SHORT',
            message: `Transitive short: "${hot.id}" reaches ground "${current}" through low-resistance path`,
            nodeIds: [hot.id, current],
          });
        }
        break;
      }
      for (const neighbor of lowRAdjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return diagnostics;
}

/** Detect open circuits — pickups that don't reach output (FR-5) */
function detectOpenCircuits(graph: Graph): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const nodes = graph.getNodes();
  // Check ALL pickup hot nodes, not just 'active' ones — an inactive pickup
  // that's wired but unreachable should still be flagged.
  const pickupHots = nodes.filter((n) => n.role === 'hot');
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
    // Only check mini DPDT switches for redundant jumpers, skip multi-position blade selectors where position jumpers are standard
    if (comp.type === 'switch_dpdt') {
      const nodes = graph.getComponentNodes(comp.id);

      // Group lugs by pole (excluding common lugs)
      const poleGroups: Map<string, string[]> = new Map();
      for (const node of nodes) {
        if (node.role === 'common') continue;
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
