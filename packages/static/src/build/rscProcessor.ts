import { drainStream } from "../util/drainStream";
import { getPayloadIDFor } from "../rsc/rscModule";
import { computeContentHash } from "./contentHash";
import { findReferencedIds, topologicalSort } from "./dependencyGraph";

export interface ProcessedComponent {
  finalId: string;
  finalContent: string;
  name?: string;
}

export interface ProcessResult {
  components: ProcessedComponent[];
  appRscContent: string;
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
 * @param appRscStream - The main RSC stream
 * @param context - Optional context for logging warnings
 */
export async function processRscComponents(
  deferRegistryIterator: AsyncIterable<RawComponent>,
  appRscStream: ReadableStream,
  context?: { warn: (message: string) => void },
): Promise<ProcessResult> {
  // Step 1: Collect all components from deferRegistry
  const components = new Map<string, string>();
  const componentNames = new Map<string, string | undefined>();
  for await (const { id, data, name } of deferRegistryIterator) {
    components.set(id, data);
    componentNames.set(id, name);
  }

  // Step 2: Drain appRsc stream to string
  let appRscContent = await drainStream(appRscStream);

  // If no components, return early
  if (components.size === 0) {
    return {
      components: [],
      appRscContent,
      idMapping: new Map(),
    };
  }

  const allIds = new Set(components.keys());

  // Step 3: Build dependency graph
  // For each component, find which other component IDs appear in its content
  const dependencies = new Map<string, Set<string>>();
  for (const [id, content] of components) {
    const otherIds = new Set(allIds);
    otherIds.delete(id); // Don't include self-references
    const refs = findReferencedIds(content, otherIds);
    dependencies.set(id, refs);
  }

  // Step 4: Topologically sort components
  const { sorted, inCycle } = topologicalSort(dependencies);

  // Step 5: Handle cycles - warn and keep original temp IDs
  const idMapping = new Map<string, string>();

  if (inCycle.length > 0) {
    context?.warn(
      `[funstack] Warning: ${inCycle.length} RSC component(s) are in dependency cycles and will keep unstable IDs: ${inCycle.join(", ")}`,
    );
    for (const id of inCycle) {
      idMapping.set(id, id); // Map to itself (keep original ID)
    }
  }

  // Step 6: Process sorted components in order
  const processedComponents: ProcessedComponent[] = [];

  for (const tempId of sorted) {
    let content = components.get(tempId)!;

    // Replace all already-finalized temp IDs with their hash-based IDs
    for (const [oldId, newId] of idMapping) {
      if (oldId !== newId) {
        content = content.replaceAll(oldId, newId);
      }
    }

    // Compute content hash for this component
    const contentHash = await computeContentHash(content);
    const finalId = getPayloadIDFor(contentHash);

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
    let content = components.get(tempId)!;

    // Replace finalized IDs in cycle member content
    for (const [oldId, newId] of idMapping) {
      if (oldId !== newId) {
        content = content.replaceAll(oldId, newId);
      }
    }

    processedComponents.push({
      finalId: tempId, // Keep original temp ID
      finalContent: content,
      name: componentNames.get(tempId),
    });
  }

  // Step 7: Process appRsc - replace all temp IDs with final IDs
  for (const [oldId, newId] of idMapping) {
    if (oldId !== newId) {
      appRscContent = appRscContent.replaceAll(oldId, newId);
    }
  }

  return {
    components: processedComponents,
    appRscContent,
    idMapping,
  };
}
