import { getPayloadIDFor } from "../rsc/rscModule";
import { computeContentHash } from "./contentHash";
import { findReferencedIds, topologicalSort } from "./dependencyGraph";
import { replaceIdsInContent } from "./idReplacement";

export interface ProcessedComponent {
  finalId: string;
  finalContent: string;
  name?: string;
}

export interface ProcessResult {
  components: ProcessedComponent[];
  idMapping: Map<string, string>;
}

interface RawComponent {
  id: string;
  data: string;
  name?: string;
}

/**
 * Processes RSC components by replacing temporary UUIDs with content-based hashes.
 *
 * @param deferRegistryIterator - Iterator yielding components with { id, data }
 * @param rscPayloadDir - Directory name used as a prefix for RSC payload IDs (e.g. "fun__rsc-payload")
 * @param context - Optional context for logging warnings
 */
export async function processRscComponents(
  deferRegistryIterator: AsyncIterable<RawComponent>,
  rscPayloadDir: string,
  context?: { warn: (message: string) => void },
): Promise<ProcessResult> {
  // Step 1: Collect all components from deferRegistry
  const components = new Map<string, string>();
  const componentNames = new Map<string, string | undefined>();
  for await (const { id, data, name } of deferRegistryIterator) {
    components.set(id, data);
    componentNames.set(id, name);
  }

  // If no components, return early
  if (components.size === 0) {
    return {
      components: [],
      idMapping: new Map(),
    };
  }

  const allIds = new Set(components.keys());

  // Step 2: Build dependency graph
  // For each component, find which other component IDs appear in its content
  const dependencies = new Map<string, Set<string>>();
  for (const [id, content] of components) {
    const otherIds = new Set(allIds);
    otherIds.delete(id); // Don't include self-references
    const refs = findReferencedIds(content, otherIds);
    dependencies.set(id, refs);
  }

  // Step 3: Topologically sort components
  const { sorted, inCycle } = topologicalSort(dependencies);

  // Step 4: Handle cycles - warn and keep original temp IDs
  const idMapping = new Map<string, string>();

  if (inCycle.length > 0) {
    context?.warn(
      `[funstack] Warning: ${inCycle.length} RSC component(s) are in dependency cycles and will keep unstable IDs: ${inCycle.join(", ")}`,
    );
    for (const id of inCycle) {
      idMapping.set(id, id); // Map to itself (keep original ID)
    }
  }

  // Step 5: Process components in dependency order (dependencies before
  // dependents), so that every referenced component's final ID is known
  // before the referencing content is hashed and frozen.
  const processedComponents: ProcessedComponent[] = [];

  for (const tempId of sorted) {
    // Replace all already-finalized temp IDs with their hash-based IDs
    const content = replaceIdsInContent(components.get(tempId)!, idMapping);

    // Compute content hash for this component
    const contentHash = await computeContentHash(content);
    const finalId = getPayloadIDFor(contentHash, rscPayloadDir);

    // Create mapping
    idMapping.set(tempId, finalId);

    processedComponents.push({
      finalId,
      finalContent: content,
      name: componentNames.get(tempId),
    });
  }

  // Add cycle members to processed components (with original IDs)
  for (const tempId of inCycle) {
    // Replace finalized IDs in cycle member content
    const content = replaceIdsInContent(components.get(tempId)!, idMapping);

    processedComponents.push({
      finalId: tempId, // Keep original temp ID
      finalContent: content,
      name: componentNames.get(tempId),
    });
  }

  return {
    components: processedComponents,
    idMapping,
  };
}
