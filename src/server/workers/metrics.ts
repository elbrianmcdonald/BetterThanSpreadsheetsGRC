/**
 * Worker Metrics Module (Story 4.18)
 *
 * In-memory metrics tracking for background workers.
 *
 * AC4: Worker logs processing metrics (emails processed, success rate, duration)
 * AC24-AC29: Worker monitoring and health check support
 */

export interface WorkerMetrics {
  /** Worker name */
  name: string;
  /** Worker status */
  status: "running" | "stopped" | "error";
  /** Whether worker is currently processing a batch */
  isProcessing: boolean;
  /** Timestamp of last successful processing */
  lastProcessedAt: Date | null;
  /** Total jobs processed in last 24 hours */
  jobsProcessedLast24h: number;
  /** Jobs successfully processed in last 24 hours */
  jobsSucceededLast24h: number;
  /** Jobs failed in last 24 hours */
  jobsFailedLast24h: number;
  /** Error count in last 24 hours */
  errorCount: number;
  /** Last error message */
  lastError: string | null;
  /** Last error timestamp */
  lastErrorAt: Date | null;
  /** Worker started at */
  startedAt: Date | null;
  /** Average processing duration in ms */
  avgProcessingDurationMs: number;
}

/**
 * Processing record for rolling window calculations
 */
interface ProcessingRecord {
  timestamp: Date;
  processed: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

/**
 * Worker metrics registry
 */
class WorkerMetricsRegistry {
  private metrics: Map<string, WorkerMetrics> = new Map();
  private processingHistory: Map<string, ProcessingRecord[]> = new Map();
  private readonly HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_HISTORY_RECORDS = 1000;

  /**
   * Initialize metrics for a worker
   */
  initializeWorker(name: string): void {
    this.metrics.set(name, {
      name,
      status: "stopped",
      isProcessing: false,
      lastProcessedAt: null,
      jobsProcessedLast24h: 0,
      jobsSucceededLast24h: 0,
      jobsFailedLast24h: 0,
      errorCount: 0,
      lastError: null,
      lastErrorAt: null,
      startedAt: null,
      avgProcessingDurationMs: 0,
    });
    this.processingHistory.set(name, []);
  }

  /**
   * Mark worker as started
   */
  markStarted(name: string): void {
    const metrics = this.getOrCreate(name);
    metrics.status = "running";
    metrics.startedAt = new Date();
  }

  /**
   * Mark worker as stopped
   */
  markStopped(name: string): void {
    const metrics = this.getOrCreate(name);
    metrics.status = "stopped";
  }

  /**
   * Mark worker as currently processing
   */
  setProcessing(name: string, isProcessing: boolean): void {
    const metrics = this.getOrCreate(name);
    metrics.isProcessing = isProcessing;
  }

  /**
   * Record a batch processing result
   */
  recordBatch(
    name: string,
    result: { processed: number; succeeded: number; failed: number; durationMs: number }
  ): void {
    const metrics = this.getOrCreate(name);
    const now = new Date();

    // Record to history
    const history = this.processingHistory.get(name) ?? [];
    history.push({
      timestamp: now,
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      durationMs: result.durationMs,
    });

    // Trim old records
    this.trimHistory(name);

    // Update metrics
    metrics.lastProcessedAt = now;
    this.recalculateTotals(name);
  }

  /**
   * Record an error
   */
  recordError(name: string, error: string): void {
    const metrics = this.getOrCreate(name);
    metrics.errorCount++;
    metrics.lastError = error;
    metrics.lastErrorAt = new Date();
    metrics.status = "error";
  }

  /**
   * Get metrics for a worker
   */
  getMetrics(name: string): WorkerMetrics | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get metrics for all workers
   */
  getAllMetrics(): WorkerMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Reset error status (called when worker recovers)
   */
  clearError(name: string): void {
    const metrics = this.getOrCreate(name);
    if (metrics.status === "error") {
      metrics.status = "running";
    }
  }

  /**
   * Get or create metrics for a worker
   */
  private getOrCreate(name: string): WorkerMetrics {
    let metrics = this.metrics.get(name);
    if (!metrics) {
      this.initializeWorker(name);
      metrics = this.metrics.get(name)!;
    }
    return metrics;
  }

  /**
   * Trim old history records
   */
  private trimHistory(name: string): void {
    const history = this.processingHistory.get(name);
    if (!history) return;

    const cutoff = new Date(Date.now() - this.HISTORY_RETENTION_MS);

    // Remove records older than 24 hours
    const filtered = history.filter((record) => record.timestamp >= cutoff);

    // Also limit to max records
    if (filtered.length > this.MAX_HISTORY_RECORDS) {
      filtered.splice(0, filtered.length - this.MAX_HISTORY_RECORDS);
    }

    this.processingHistory.set(name, filtered);
  }

  /**
   * Recalculate totals from history
   */
  private recalculateTotals(name: string): void {
    const metrics = this.metrics.get(name);
    const history = this.processingHistory.get(name);
    if (!metrics || !history) return;

    const cutoff = new Date(Date.now() - this.HISTORY_RETENTION_MS);
    const recentRecords = history.filter((r) => r.timestamp >= cutoff);

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    for (const record of recentRecords) {
      totalProcessed += record.processed;
      totalSucceeded += record.succeeded;
      totalFailed += record.failed;
      totalDuration += record.durationMs;
    }

    metrics.jobsProcessedLast24h = totalProcessed;
    metrics.jobsSucceededLast24h = totalSucceeded;
    metrics.jobsFailedLast24h = totalFailed;
    metrics.avgProcessingDurationMs =
      recentRecords.length > 0 ? Math.round(totalDuration / recentRecords.length) : 0;
  }
}

/** Singleton metrics registry */
export const workerMetrics = new WorkerMetricsRegistry();
