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
 * Solve the active signal paths in the circuit graph.
 *
 * Starting from all pickup terminals (source nodes), finds all paths
 * that reach the output jack through the current switch/pot configuration.
 */
export function solveSignalPaths(graph: Graph): SolverResult {
  const nodes = graph.getNodes();
  const edges = graph.getEdges();

  // Find source nodes (pickup terminals with 'hot' role)
  const sourceNodes = nodes.filter(
    (n) => n.type === 'terminal' && n.role === 'hot' && n.signalState === 'active',
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
      // Source doesn't reach any output — mark its reachable set as dead-end
      const reachable = graph.getConnectedComponent(source.id);
      for (const nodeId of reachable) {
        if (!activeNodes.has(nodeId)) {
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
