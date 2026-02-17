/**
 * Workers Module (Story 4.15 + Story 4.18)
 *
 * Entry point for background workers with graceful shutdown support.
 *
 * Story 4.18 Enhancements:
 * - AC9: Worker includes graceful shutdown on SIGTERM/SIGINT
 * - AC30: Worker starts automatically when app starts
 * - AC35: Worker shutdown gracefully when Docker container stopped
 *
 * Exports:
 * - startWorkers(): Initialize all background workers
 * - stopWorkers(): Gracefully stop all workers
 * - Worker metrics and status functions
 */

export * from "./emailWorker";
export * from "./scheduler";
export * from "./metrics";
export * from "./jobTypes";

import { stopWorkers } from "./scheduler";

/**
 * Flag to track if shutdown handlers have been registered
 */
let shutdownHandlersRegistered = false;

/**
 * Register graceful shutdown handlers for SIGTERM/SIGINT
 *
 * AC9: Worker includes graceful shutdown on SIGTERM/SIGINT
 * AC35: Worker shutdown gracefully when Docker container stopped
 *
 * Call this once during app initialization.
 */
export function registerShutdownHandlers(): void {
  if (shutdownHandlersRegistered) {
    return;
  }

  // AC9, AC35: Handle SIGTERM (Docker stop, Kubernetes termination)
  process.on("SIGTERM", async () => {
    console.log("[Workers] SIGTERM received, shutting down gracefully...");
    await stopWorkers();
    console.log("[Workers] Graceful shutdown complete");
    process.exit(0);
  });

  // AC9: Handle SIGINT (Ctrl+C in development)
  process.on("SIGINT", async () => {
    console.log("[Workers] SIGINT received, shutting down gracefully...");
    await stopWorkers();
    console.log("[Workers] Graceful shutdown complete");
    process.exit(0);
  });

  shutdownHandlersRegistered = true;
  console.log("[Workers] Shutdown handlers registered");
}
