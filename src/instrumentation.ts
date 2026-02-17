/**
 * Next.js Instrumentation - Server Startup Hooks
 *
 * This file runs once when the server starts.
 * Used to initialize services that need to run before handling requests.
 *
 * Story 3.2: File Storage in Docker Volumes
 * Story 4.18: Background Job Processing
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { fileStorageService } = await import("@/server/services/file-storage");

    try {
      // Initialize file storage - verifies volume is mounted and writable
      await fileStorageService.initialize();
      console.log("[Instrumentation] File storage initialized successfully");
    } catch (error) {
      // Log error but don't crash - the health check endpoint will report the issue
      console.error("[Instrumentation] File storage initialization failed:", error);
      console.error("[Instrumentation] File uploads will not work until this is resolved");

      // In production, we might want to exit if storage is critical
      // For now, we log the error and continue
      if (process.env.NODE_ENV === "production") {
        console.error("[Instrumentation] CRITICAL: File storage unavailable in production");
        // Optionally: process.exit(1) to fail fast
      }
    }

    // Story 4.18: Start background workers
    try {
      const { startWorkers, registerShutdownHandlers } = await import(
        "@/server/workers"
      );

      // Register SIGTERM/SIGINT handlers for graceful shutdown
      registerShutdownHandlers();

      // Start background workers (respects WORKER_ENABLED env var)
      startWorkers();
      console.log("[Instrumentation] Background workers initialized");
    } catch (error) {
      // Log error but don't crash - workers can be started later
      console.error("[Instrumentation] Worker initialization failed:", error);

      // In production, this is a concern but not critical
      if (process.env.NODE_ENV === "production") {
        console.error("[Instrumentation] WARNING: Background workers unavailable");
      }
    }
  }
}
