// Prefix for global variables
const globalPrefix = "FUNSTACK_STATIC_";

/**
 * Variable name for the app client manifest
 */
export const appClientManifestVar = `${globalPrefix}appClientManifest`;

export interface AppClientManifest {
  marker?: string;
  stream: string;
}
