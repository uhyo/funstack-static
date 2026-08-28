import React from "react";
import { useRouteParams } from "@funstack/router";
import { DeferredComponent } from "./clientWrapper";
import { paramsKey, type FsRouteSlotProps } from "../fs-routes/slot";

/**
 * Stand-in for a Server Component page or layout under file-system routing.
 *
 * Rendered in place of the server element in the route definitions, it reads
 * the live params of the current match through the route object and renders
 * the pre-rendered RSC chunk for those params: the inline `initial` output
 * for the params this payload was built with, or the chunk fetched from
 * `chunks` after a soft client-side navigation to a sibling page of the same
 * dynamic route.
 */
export function FsRouteSlot(props: FsRouteSlotProps): React.ReactNode {
  const params = useRouteParams(props.route);
  const key = paramsKey(props.paramNames, params);
  if (key === props.initialKey) {
    return props.initial;
  }
  const chunkId = props.chunks[key];
  // Remount the boundary per params key so an error for one destination
  // does not stick to the next navigation.
  return (
    <FsRouteChunkBoundary key={key}>
      {chunkId === undefined ? (
        <MissingChunk paramsKey={key} />
      ) : (
        <DeferredComponent moduleID={chunkId} />
      )}
    </FsRouteChunkBoundary>
  );
}

function MissingChunk(props: { paramsKey: string }): never {
  throw new Error(
    `No statically generated page exists for params ${props.paramsKey}. ` +
      `Soft navigation can only render params enumerated by generateStaticParams().`,
  );
}

/**
 * Timestamp of the last hard-navigation fallback, kept in sessionStorage to
 * break reload loops: a page that fails again right after a fallback reload
 * surfaces the error instead of reloading forever.
 */
const reloadGuardKey = "funstack:fs-route-chunk-reload";
const reloadGuardWindowMs = 10_000;

interface FsRouteChunkBoundaryState {
  error?: unknown;
  surface?: boolean;
}

/**
 * Recovers from a failed chunk resolution (a params combination that was
 * never generated, or a fetch failure — typically version skew after a
 * redeploy removed the content-hashed chunk) by falling back to a hard
 * navigation, which loads the destination's own HTML. The static build
 * cannot produce this error, so recovery only ever runs in the browser.
 */
class FsRouteChunkBoundary extends React.Component<
  { children: React.ReactNode },
  FsRouteChunkBoundaryState
> {
  override state: FsRouteChunkBoundaryState = {};

  static getDerivedStateFromError(error: unknown): FsRouteChunkBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown): void {
    let lastReload = 0;
    try {
      lastReload = Number(sessionStorage.getItem(reloadGuardKey)) || 0;
    } catch {
      // sessionStorage unavailable: fall through with no guard record,
      // reloading at most once more.
    }
    if (Date.now() - lastReload < reloadGuardWindowMs) {
      this.setState({ surface: true });
      return;
    }
    try {
      sessionStorage.setItem(reloadGuardKey, String(Date.now()));
    } catch {
      // Ignore; the guard read above degrades gracefully.
    }
    console.error(
      "[funstack] Failed to load the RSC chunk for this navigation; falling back to a full page load.",
      error,
    );
    location.assign(location.href);
  }

  override render(): React.ReactNode {
    if (this.state.error !== undefined) {
      if (this.state.surface) {
        throw this.state.error;
      }
      // A hard navigation is underway; render nothing meanwhile.
      return null;
    }
    return this.props.children;
  }
}
