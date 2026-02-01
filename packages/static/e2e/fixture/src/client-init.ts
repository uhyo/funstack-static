// Client initialization - runs before React hydration
// Sets a global marker to verify execution timing

declare global {
  interface Window {
    __CLIENT_INIT_RAN__: boolean;
    __CLIENT_INIT_TIMESTAMP__: number;
  }
}

window.__CLIENT_INIT_RAN__ = true;
window.__CLIENT_INIT_TIMESTAMP__ = Date.now();
