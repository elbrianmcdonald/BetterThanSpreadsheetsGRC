/**
 * Job Types and Future Job Framework (Story 4.18)
 *
 * AC19: Job framework supports multiple job types
 * AC20: Job type enum: EMAIL_SEND, COMPLIANCE_REFRESH, REPORT_GENERATION
 * AC21: Worker architecture allows adding new job processors (plugin pattern)
 * AC22: Job queue design supports priority
 * AC23: Job history retained for troubleshooting
 *
 * ## Adding a New Job Type
 *
 * 1. Add the job type to the JobType enum below
 * 2. Create a processor function matching the JobProcessor type
 * 3. Register it with registerJobProcessor()
 * 4. Optionally create a job queue table in Prisma if needed
 *
 * Example:
 * ```typescript
 * import { JobType, registerJobProcessor } from './jobTypes';
 *
 * async function processComplianceRefresh(jobData: unknown) {
 *   // Your processing logic here
 *   return { success: true };
 * }
 *
 * registerJobProcessor(JobType.COMPLIANCE_REFRESH, processComplianceRefresh);
 * ```
 */

/**
 * Job type enum
 *
 * AC20: Defines available job types for background processing
 */
export enum JobType {
  /** Email sending jobs (currently implemented via EmailQueue) */
  EMAIL_SEND = "EMAIL_SEND",

  /** Compliance status recalculation (future) */
  COMPLIANCE_REFRESH = "COMPLIANCE_REFRESH",

  /** Report generation jobs (future) */
  REPORT_GENERATION = "REPORT_GENERATION",

  /** Data cleanup and maintenance (future) */
  DATA_CLEANUP = "DATA_CLEANUP",

  /** Control mapping recalculation (future) */
  CONTROL_MAPPING_SYNC = "CONTROL_MAPPING_SYNC",
}

/**
 * Job priority levels
 *
 * AC22: Job queue design supports priority
 */
export enum JobPriority {
  /** Low priority - process when idle */
  LOW = 0,
  /** Normal priority - default for most jobs */
  NORMAL = 1,
  /** High priority - process before normal jobs */
  HIGH = 2,
  /** Critical priority - process immediately */
  CRITICAL = 3,
}

/**
 * Job processing result
 */
export interface JobResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: unknown;
}

/**
 * Job processor function signature
 *
 * AC21: Plugin pattern for job processors
 */
export type JobProcessor = (jobData: unknown) => Promise<JobResult>;

/**
 * Job processor metadata
 */
interface JobProcessorEntry {
  processor: JobProcessor;
  description: string;
  registeredAt: Date;
}

/**
 * Job processor registry
 *
 * AC21: Worker architecture allows adding new job processors without code changes
 */
const jobProcessors = new Map<JobType, JobProcessorEntry>();

/**
 * Register a job processor for a job type
 *
 * @param jobType - The job type to handle
 * @param processor - The processor function
 * @param description - Optional description of what this processor does
 *
 * @example
 * ```typescript
 * registerJobProcessor(
 *   JobType.REPORT_GENERATION,
 *   async (data) => {
 *     const report = await generateReport(data);
 *     return { success: true, data: { reportId: report.id } };
 *   },
 *   "Generates PDF reports for compliance audits"
 * );
 * ```
 */
export function registerJobProcessor(
  jobType: JobType,
  processor: JobProcessor,
  description = "No description provided"
): void {
  if (jobProcessors.has(jobType)) {
    console.warn(`[JobTypes] Overwriting processor for job type: ${jobType}`);
  }

  jobProcessors.set(jobType, {
    processor,
    description,
    registeredAt: new Date(),
  });

  console.log(`[JobTypes] Registered processor for: ${jobType}`);
}

/**
 * Unregister a job processor
 *
 * @param jobType - The job type to unregister
 */
export function unregisterJobProcessor(jobType: JobType): boolean {
  const existed = jobProcessors.delete(jobType);
  if (existed) {
    console.log(`[JobTypes] Unregistered processor for: ${jobType}`);
  }
  return existed;
}

/**
 * Get a registered job processor
 *
 * @param jobType - The job type
 * @returns The processor or undefined if not registered
 */
export function getJobProcessor(jobType: JobType): JobProcessor | undefined {
  return jobProcessors.get(jobType)?.processor;
}

/**
 * Check if a job processor is registered
 *
 * @param jobType - The job type to check
 */
export function hasJobProcessor(jobType: JobType): boolean {
  return jobProcessors.has(jobType);
}

/**
 * Get all registered job processors
 *
 * @returns Map of job types to their metadata
 */
export function getRegisteredProcessors(): Map<
  JobType,
  { description: string; registeredAt: Date }
> {
  const result = new Map<JobType, { description: string; registeredAt: Date }>();
  for (const [jobType, entry] of jobProcessors) {
    result.set(jobType, {
      description: entry.description,
      registeredAt: entry.registeredAt,
    });
  }
  return result;
}

/**
 * Process a job using the registered processor
 *
 * @param jobType - The type of job
 * @param jobData - The job data to process
 * @returns Job processing result
 */
export async function processJob(
  jobType: JobType,
  jobData: unknown
): Promise<JobResult> {
  const entry = jobProcessors.get(jobType);

  if (!entry) {
    return {
      success: false,
      error: `No processor registered for job type: ${jobType}`,
    };
  }

  try {
    return await entry.processor(jobData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Job history entry for troubleshooting
 *
 * AC23: Job history retained for troubleshooting
 */
export interface JobHistoryEntry {
  id: string;
  jobType: JobType;
  priority: JobPriority;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  result: JobResult | null;
  retryCount: number;
}

/**
 * In-memory job history (for MVP - could be moved to database later)
 *
 * AC23: Retains last 1000 jobs
 */
const jobHistory: JobHistoryEntry[] = [];
const MAX_HISTORY_SIZE = 1000;

/**
 * Add entry to job history
 */
export function addJobHistory(entry: JobHistoryEntry): void {
  jobHistory.push(entry);

  // Trim to max size
  while (jobHistory.length > MAX_HISTORY_SIZE) {
    jobHistory.shift();
  }
}

/**
 * Get job history (most recent first)
 *
 * @param limit - Maximum entries to return (default 100)
 * @param jobType - Optional filter by job type
 */
export function getJobHistory(
  limit = 100,
  jobType?: JobType
): JobHistoryEntry[] {
  let filtered = jobHistory;

  if (jobType) {
    filtered = jobHistory.filter((e) => e.jobType === jobType);
  }

  // Return most recent first
  return filtered.slice(-limit).reverse();
}

/**
 * Clear job history (for testing)
 */
export function clearJobHistory(): void {
  jobHistory.length = 0;
}
