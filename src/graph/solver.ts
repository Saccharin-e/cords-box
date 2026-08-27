/**
 * Signal Path Solver
 *
 * Real-time BFS/DFS traversal to resolve active signal paths
 * from pickups to output jack through the circuit graph (FR-3).
 * Fully decoupled from UI — runs headless for CI testing (NFR-4).
 */

import { Graph } from './Graph';
import type { CircuitNode } from './types';

export interface SignalPath {
  /** Ordered list of node IDs from source to destination */
  nodes: string[];
  /** Edge IDs traversed */
  edges: string[];
  /** Whether this path reaches the output jack */
  reachesOutput: boolean;
}

export interface SolverResult {
  /** All active signal paths found */
  activePaths: SignalPath[];
  /** Nodes that are part of the active signal path */
  activeNodes: Set<string>;
  /** Edges that are part of the active signal path */
  activeEdges: Set<string>;
  /** Nodes that are energized but not reaching output */
  deadEndNodes: Set<string>;
}

/**
 * Synchronize internal switch contact edges based on each switch component's current position.
 */
export function syncSwitchInternalEdges(graph: Graph): void {
  const components = graph.getComponents();
  const switchComps = components.filter((c) => c.type.startsWith('switch_') || c.type === 'pot_pushpull');

  for (const comp of switchComps) {
    const swState = graph.getSwitchState(comp.id);
    const pos = swState?.currentPosition ?? 1;

    // Remove existing internal switch edges for this component
    const existingEdges = graph
      .getEdges()
      .filter((e) => e.id.startsWith(`internal_sw_${comp.id}_`));
    for (const e of existingEdges) {
      graph.removeEdge(e.id);
    }

    const contacts: [string, string][] = [];

    if (comp.type === 'switch_3way') {
      if (pos === 1) {
        contacts.push([`${comp.id}_pos1`, `${comp.id}_common`]);
      } else if (pos === 2) {
        contacts.push([`${comp.id}_pos1`, `${comp.id}_common`]);
        contacts.push([`${comp.id}_pos3`, `${comp.id}_common`]);
      } else if (pos === 3) {
        contacts.push([`${comp.id}_pos3`, `${comp.id}_common`]);
      }
    } else if (comp.type === 'switch_4way') {
      // Real Oak Grigsby 2-pole 4-position: both poles always connect,
      // one lug per pole per position. Selection depends on wiring.
      contacts.push([`${comp.id}_poleA_pos${pos}`, `${comp.id}_poleA_common`]);
      contacts.push([`${comp.id}_poleB_pos${pos}`, `${comp.id}_poleB_common`]);
    } else if (comp.type === 'switch_5way') {
      if (pos === 1) {
        contacts.push([`${comp.id}_poleA_pos1`, `${comp.id}_poleA_common`]);
      } else if (pos === 2) {
        contacts.push([`${comp.id}_poleA_pos1`, `${comp.id}_poleA_common`]);
        contacts.push([`${comp.id}_poleA_pos2`, `${comp.id}_poleA_common`]);
      } else if (pos === 3) {
        contacts.push([`${comp.id}_poleA_pos2`, `${comp.id}_poleA_common`]);
      } else if (pos === 4) {
        contacts.push([`${comp.id}_poleA_pos2`, `${comp.id}_poleA_common`]);
        contacts.push([`${comp.id}_poleA_pos3`, `${comp.id}_poleA_common`]);
      } else if (pos === 5) {
        contacts.push([`${comp.id}_poleA_pos3`, `${comp.id}_poleA_common`]);
      }
    } else if (comp.type === 'switch_dpdt') {
      if (pos === 1) {
        contacts.push([`${comp.id}_poleA_common`, `${comp.id}_poleA_pos1`]);
        contacts.push([`${comp.id}_poleB_common`, `${comp.id}_poleB_pos1`]);
      } else if (pos === 2) {
        contacts.push([`${comp.id}_poleA_common`, `${comp.id}_poleA_pos2`]);
        contacts.push([`${comp.id}_poleB_common`, `${comp.id}_poleB_pos2`]);
      }
    } else if (comp.type === 'pot_pushpull') {
      // Push-pull pot has an integrated DPDT switch.
      // _swA2 / _swB2 are the commons; _swA1/_swB1 are pos1, _swA3/_swB3 are pos2.
      // pos 1 = pushed (normal), pos 2 = pulled
      if (pos === 1) {
        contacts.push([`${comp.id}_swA2`, `${comp.id}_swA1`]);
        contacts.push([`${comp.id}_swB2`, `${comp.id}_swB1`]);
      } else if (pos === 2) {
        contacts.push([`${comp.id}_swA2`, `${comp.id}_swA3`]);
        contacts.push([`${comp.id}_swB2`, `${comp.id}_swB3`]);
      }
    }

    contacts.forEach(([src, tgt], idx) => {
      if (graph.getNode(src) && graph.getNode(tgt)) {
        try {
          graph.addEdge({
            id: `internal_sw_${comp.id}_${idx}`,
            source: src,
            target: tgt,
            resistance: 0.001,
            wireColor: '#ffffff',
            connectionType: 'solder',
            wireType: 'vintage_cloth_pushback',
          });
        } catch {
          // Edge already exists
        }
      }
    });
  }
}

/**
 * Solve the active signal paths in the circuit graph.
 *
 * Starting from all pickup terminals (source nodes), finds all paths
 * that reach the output jack through the current switch/pot configuration.
 */
export function solveSignalPaths(graph: Graph): SolverResult {
  // Sync internal switch contacts before solving path graph
  syncSwitchInternalEdges(graph);

  const nodes = graph.getNodes();
  const edges = graph.getEdges();

  // Find source nodes from the component schema, not an arbitrary id prefix.
  // The prefix fallback keeps older node-only fixtures/imports readable until
  // they are migrated to complete component records.
  const sourceNodes = nodes.filter(
    (node) => {
      if (node.role !== 'hot' && node.role !== 'ground') return false;
      const component = graph.getComponent(node.componentId);
      if (!component) return node.componentId.startsWith('pickup');
      return (
        component.type === 'pickup_single_coil' ||
        component.type === 'pickup_humbucker' ||
        component.type === 'pickup_p90'
      );
    },
  );

  // Find destination nodes (output jack terminals)
  const outputNodes = nodes.filter((n) => n.type === 'jack_terminal' && n.role === 'tip');

  const activePaths: SignalPath[] = [];
  const activeNodes = new Set<string>();
  const activeEdges = new Set<string>();
  const deadEndNodes = new Set<string>();

  for (const source of sourceNodes) {
    let sourceReachesOutput = false;

    for (const output of outputNodes) {
      const path = findPath(graph, source.id, output.id, nodes, edges);
      if (path) {
        sourceReachesOutput = true;
        activePaths.push(path);
        for (const nodeId of path.nodes) {
          activeNodes.add(nodeId);
        }
        for (const edgeId of path.edges) {
          activeEdges.add(edgeId);
        }
      }
    }

    if (!sourceReachesOutput) {
      // Source doesn't reach any output — mark its non-ground reachable set as dead-end
      const reachable = graph.getConnectedComponent(source.id);
      for (const nodeId of reachable) {
        const node = graph.getNode(nodeId);
        if (!activeNodes.has(nodeId) && node?.type !== 'ground' && node?.role !== 'ground') {
          deadEndNodes.add(nodeId);
        }
      }
    }
  }

  return { activePaths, activeNodes, activeEdges, deadEndNodes };
}

/**
 * BFS pathfinding between two nodes.
 * Returns the path if found, null otherwise.
 */
function findPath(
  graph: Graph,
  startId: string,
  endId: string,
  _nodes: ReadonlyArray<CircuitNode>,
  _edges: ReadonlyArray<{ id: string; source: string; target: string }>,
): SignalPath | null {
  if (startId === endId) {
    return { nodes: [startId], edges: [], reachesOutput: true };
  }

  const visited = new Set<string>();
  const parent = new Map<string, { nodeId: string; edgeId: string }>();
  const queue = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === endId) {
      // Reconstruct path
      const pathNodes: string[] = [];
      const pathEdges: string[] = [];
      let cursor = endId;

      while (cursor !== startId) {
        pathNodes.unshift(cursor);
        const parentInfo = parent.get(cursor)!;
        pathEdges.unshift(parentInfo.edgeId);
        cursor = parentInfo.nodeId;
      }
      pathNodes.unshift(startId);

      return { nodes: pathNodes, edges: pathEdges, reachesOutput: true };
    }

    const neighbors = graph.getNeighbors(current);
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        // Find the edge connecting current to neighbor
        const connectingEdges = graph.getEdgesBetween(current, neighborId);
        if (connectingEdges.length > 0) {
          parent.set(neighborId, { nodeId: current, edgeId: connectingEdges[0].id });
          queue.push(neighborId);
        }
      }
    }
  }

  return null;
}

/**
 * Update signal states for all nodes based on the solver result.
 * Active path nodes get 'active', dead ends get 'inactive',
 * ground-connected nodes get 'grounded'.
 */
export function updateSignalStates(graph: Graph, result: SolverResult): void {
  for (const node of graph.getNodes()) {
    const mutableNode = node as CircuitNode;
    if (result.activeNodes.has(node.id)) {
      mutableNode.signalState = 'active';
    } else if (node.type === 'ground') {
      mutableNode.signalState = 'grounded';
    } else {
      mutableNode.signalState = 'inactive';
    }
  }
}
