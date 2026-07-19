/**
 * Result of topological sort.
 */
export interface SortResult {
  /** Components that can be processed in dependency order */
  sorted: string[];
  /** Components stuck in cycles (cannot determine stable order) */
  inCycle: string[];
}

/**
 * Finds which IDs from the known set are referenced in the given content.
 */
export function findReferencedIds(
  content: string,
  allKnownIds: Set<string>,
): Set<string> {
  const referenced = new Set<string>();
  for (const id of allKnownIds) {
    if (content.includes(id)) {
      referenced.add(id);
    }
  }
  return referenced;
}

/**
 * Performs topological sort using Kahn's algorithm.
 * Returns both the sorted nodes and any nodes that are part of cycles.
 *
 * The sorted nodes are in dependency order: every node appears after all of
 * the nodes it references. This lets callers process a node knowing that
 * everything it references has already been processed (used by the build to
 * finalize content-hashed IDs of referenced payloads before hashing the
 * referencing payload).
 *
 * @param dependencies - Map of node ID to the set of IDs it depends on (references)
 */
export function topologicalSort(
  dependencies: Map<string, Set<string>>,
): SortResult {
  const allNodes = new Set(dependencies.keys());

  // Calculate in-degree for each node (how many other nodes reference it)
  const inDegree = new Map<string, number>();
  for (const node of allNodes) {
    inDegree.set(node, 0);
  }

  for (const [_node, deps] of dependencies) {
    for (const dep of deps) {
      if (allNodes.has(dep)) {
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }
  }

  // Start with nodes that have in-degree 0 (no one references them)
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    // Decrement in-degree of nodes this node depends on
    const deps = dependencies.get(node);
    if (deps) {
      for (const dep of deps) {
        if (allNodes.has(dep)) {
          const newDegree = (inDegree.get(dep) ?? 1) - 1;
          inDegree.set(dep, newDegree);
          if (newDegree === 0) {
            queue.push(dep);
          }
        }
      }
    }
  }

  // Nodes not in sorted result are part of cycles
  const inCycle: string[] = [];
  for (const node of allNodes) {
    if (!sorted.includes(node)) {
      inCycle.push(node);
    }
  }

  // Kahn's traversal above visits dependents before their dependencies
  // (it starts from unreferenced nodes); reverse to get dependency order.
  sorted.reverse();

  return { sorted, inCycle };
}
