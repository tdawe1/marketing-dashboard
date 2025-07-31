import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { CronJob } from "encore.dev/cron";

const schedulerDB = new SQLDatabase("scheduler", {
  migrations: "./migrations",
});

export interface ScheduledJob {
  id: string;
  name: string;
  description?: string;
  platform: "google-analytics" | "google-ads" | "facebook-ads";
  accountId: string;
  frequency: "daily" | "weekly" | "monthly";
  timeOfDay: string; // HH:MM format
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  timezone: string;
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  createdAt: Date;
  updatedAt: Date;
  metrics: string[];
  dimensions: string[];
  notificationEmail?: string;
  autoAnalyze: boolean;
  analysisType: "insights" | "recommendations" | "summary";
}

export interface JobExecution {
  id: number;
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed";
  fileId?: string;
  analysisId?: string;
  rowsFetched?: number;
  errorMessage?: string;
  executionTimeMs?: number;
}

export interface HistoricalAnalysis {
  id: string;
  jobId: string;
  fileId: string;
  executionId: number;
  analysisData: any;
  createdAt: Date;
  dateRangeStart: string;
  dateRangeEnd: string;
  totalRows: number;
  keyMetrics?: Record<string, number>;
  insightsCount: number;
  recommendationsCount: number;
}

export interface TrendComparison {
  id: number;
  jobId: string;
  currentAnalysisId: string;
  previousAnalysisId: string;
  comparisonData: any;
  createdAt: Date;
  significantChanges: number;
  improvementAreas: number;
  declineAreas: number;
}

export interface CreateScheduledJobRequest {
  name: string;
  description?: string;
  platform: "google-analytics" | "google-ads" | "facebook-ads";
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  frequency: "daily" | "weekly" | "monthly";
  timeOfDay: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
  metrics?: string[];
  dimensions?: string[];
  notificationEmail?: string;
  autoAnalyze?: boolean;
  analysisType?: "insights" | "recommendations" | "summary";
}

export interface UpdateScheduledJobRequest {
  jobId: string;
  name?: string;
  description?: string;
  frequency?: "daily" | "weekly" | "monthly";
  timeOfDay?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  metrics?: string[];
  dimensions?: string[];
  notificationEmail?: string;
  autoAnalyze?: boolean;
  analysisType?: "insights" | "recommendations" | "summary";
  isActive?: boolean;
}

export interface ScheduledJobsResponse {
  jobs: ScheduledJob[];
  totalCount: number;
}

export interface JobExecutionsResponse {
  executions: JobExecution[];
  totalCount: number;
}

export interface HistoricalAnalysesResponse {
  analyses: HistoricalAnalysis[];
  totalCount: number;
}

export interface TrendComparisonResponse {
  comparison: TrendComparison;
  insights: Array<{
    metric: string;
    currentValue: number;
    previousValue: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
    significance: "high" | "medium" | "low";
  }>;
}

// Creates a new scheduled job for automated data fetching and analysis.
export const createScheduledJob = api<CreateScheduledJobRequest, { jobId: string }>(
  { expose: true, method: "POST", path: "/scheduled-jobs" },
  async (req) => {
    try {
      // Validate input
      if (!req.name || !req.platform || !req.accountId || !req.accessToken || !req.frequency) {
        throw APIError.invalidArgument("Missing required fields", {
          code: "MISSING_FIELDS",
          message: "Name, platform, account ID, access token, and frequency are required",
          suggestion: "Please provide all required fields"
        });
      }

      // Validate frequency-specific fields
      if (req.frequency === "weekly" && (req.dayOfWeek === undefined || req.dayOfWeek < 0 || req.dayOfWeek > 6)) {
        throw APIError.invalidArgument("Invalid day of week", {
          code: "INVALID_DAY_OF_WEEK",
          message: "Day of week must be between 0 (Sunday) and 6 (Saturday) for weekly schedules",
          suggestion: "Please provide a valid day of week (0-6)"
        });
      }

      if (req.frequency === "monthly" && (req.dayOfMonth === undefined || req.dayOfMonth < 1 || req.dayOfMonth > 31)) {
        throw APIError.invalidArgument("Invalid day of month", {
          code: "INVALID_DAY_OF_MONTH",
          message: "Day of month must be between 1 and 31 for monthly schedules",
          suggestion: "Please provide a valid day of month (1-31)"
        });
      }

      // Generate job ID
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate next run time
      const nextRun = calculateNextRun(
        req.frequency,
        req.timeOfDay,
        req.dayOfWeek,
        req.dayOfMonth,
        req.timezone
      );

      // Set default metrics and dimensions based on platform
      const defaultConfig = getDefaultPlatformConfig(req.platform);
      const metrics = req.metrics && req.metrics.length > 0 ? req.metrics : defaultConfig.metrics;
      const dimensions = req.dimensions && req.dimensions.length > 0 ? req.dimensions : defaultConfig.dimensions;

      // Insert scheduled job
      await schedulerDB.exec`
        INSERT INTO scheduled_jobs (
          id, name, description, platform, account_id, access_token, refresh_token,
          frequency, time_of_day, day_of_week, day_of_month, timezone, next_run,
          metrics, dimensions, notification_email, auto_analyze, analysis_type
        ) VALUES (
          ${jobId}, ${req.name}, ${req.description || null}, ${req.platform}, ${req.accountId},
          ${req.accessToken}, ${req.refreshToken || null}, ${req.frequency}, ${req.timeOfDay},
          ${req.dayOfWeek || null}, ${req.dayOfMonth || null}, ${req.timezone}, ${nextRun.toISOString()},
          ${JSON.stringify(metrics)}, ${JSON.stringify(dimensions)}, ${req.notificationEmail || null},
          ${req.autoAnalyze !== false}, ${req.analysisType || 'insights'}
        )
      `;

      return { jobId };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to create scheduled job", {
        code: "CREATE_JOB_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again or contact support"
      });
    }
  }
);

// Updates an existing scheduled job.
export const updateScheduledJob = api<UpdateScheduledJobRequest, { success: boolean }>(
  { expose: true, method: "PUT", path: "/scheduled-jobs/:jobId" },
  async (req) => {
    try {
      // Check if job exists
      const existingJob = await schedulerDB.queryRow`
        SELECT * FROM scheduled_jobs WHERE id = ${req.jobId}
      `;

      if (!existingJob) {
        throw APIError.notFound("Scheduled job not found", {
          code: "JOB_NOT_FOUND",
          message: `No scheduled job found with ID: ${req.jobId}`,
          suggestion: "Please check the job ID and try again"
        });
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (req.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(req.name);
      }

      if (req.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(req.description);
      }

      if (req.frequency !== undefined) {
        updates.push(`frequency = $${paramIndex++}`);
        values.push(req.frequency);
      }

      if (req.timeOfDay !== undefined) {
        updates.push(`time_of_day = $${paramIndex++}`);
        values.push(req.timeOfDay);
      }

      if (req.dayOfWeek !== undefined) {
        updates.push(`day_of_week = $${paramIndex++}`);
        values.push(req.dayOfWeek);
      }

      if (req.dayOfMonth !== undefined) {
        updates.push(`day_of_month = $${paramIndex++}`);
        values.push(req.dayOfMonth);
      }

      if (req.timezone !== undefined) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(req.timezone);
      }

      if (req.metrics !== undefined) {
        updates.push(`metrics = $${paramIndex++}`);
        values.push(JSON.stringify(req.metrics));
      }

      if (req.dimensions !== undefined) {
        updates.push(`dimensions = $${paramIndex++}`);
        values.push(JSON.stringify(req.dimensions));
      }

      if (req.notificationEmail !== undefined) {
        updates.push(`notification_email = $${paramIndex++}`);
        values.push(req.notificationEmail);
      }

      if (req.autoAnalyze !== undefined) {
        updates.push(`auto_analyze = $${paramIndex++}`);
        values.push(req.autoAnalyze);
      }

      if (req.analysisType !== undefined) {
        updates.push(`analysis_type = $${paramIndex++}`);
        values.push(req.analysisType);
      }

      if (req.isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(req.isActive);
      }

      // Always update the updated_at timestamp
      updates.push(`updated_at = NOW()`);

      // Recalculate next run if schedule parameters changed
      if (req.frequency !== undefined || req.timeOfDay !== undefined || 
          req.dayOfWeek !== undefined || req.dayOfMonth !== undefined || req.timezone !== undefined) {
        const nextRun = calculateNextRun(
          req.frequency || existingJob.frequency,
          req.timeOfDay || existingJob.time_of_day,
          req.dayOfWeek !== undefined ? req.dayOfWeek : existingJob.day_of_week,
          req.dayOfMonth !== undefined ? req.dayOfMonth : existingJob.day_of_month,
          req.timezone || existingJob.timezone
        );
        updates.push(`next_run = $${paramIndex++}`);
        values.push(nextRun.toISOString());
      }

      if (updates.length === 1) { // Only updated_at
        return { success: true };
      }

      // Add job ID as the last parameter
      values.push(req.jobId);

      const query = `UPDATE scheduled_jobs SET ${updates.join(', ')} WHERE id = $${paramIndex}`;
      await schedulerDB.rawExec(query, ...values);

      return { success: true };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to update scheduled job", {
        code: "UPDATE_JOB_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again or contact support"
      });
    }
  }
);

// Retrieves all scheduled jobs for the user.
export const getScheduledJobs = api<{ limit?: number; offset?: number }, ScheduledJobsResponse>(
  { expose: true, method: "GET", path: "/scheduled-jobs" },
  async (req) => {
    try {
      const limit = req.limit || 50;
      const offset = req.offset || 0;

      const jobs = await schedulerDB.queryAll`
        SELECT 
          id, name, description, platform, account_id, frequency, time_of_day,
          day_of_week, day_of_month, timezone, is_active, last_run, next_run,
          created_at, updated_at, metrics, dimensions, notification_email,
          auto_analyze, analysis_type
        FROM scheduled_jobs
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await schedulerDB.queryRow`
        SELECT COUNT(*) as total FROM scheduled_jobs
      `;

      const mappedJobs: ScheduledJob[] = jobs.map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        platform: job.platform,
        accountId: job.account_id,
        frequency: job.frequency,
        timeOfDay: job.time_of_day,
        dayOfWeek: job.day_of_week,
        dayOfMonth: job.day_of_month,
        timezone: job.timezone,
        isActive: job.is_active,
        lastRun: job.last_run ? new Date(job.last_run) : undefined,
        nextRun: new Date(job.next_run),
        createdAt: new Date(job.created_at),
        updatedAt: new Date(job.updated_at),
        metrics: JSON.parse(job.metrics || '[]'),
        dimensions: JSON.parse(job.dimensions || '[]'),
        notificationEmail: job.notification_email,
        autoAnalyze: job.auto_analyze,
        analysisType: job.analysis_type
      }));

      return {
        jobs: mappedJobs,
        totalCount: parseInt(countResult?.total || '0')
      };
    } catch (error) {
      throw APIError.internal("Failed to retrieve scheduled jobs", {
        code: "GET_JOBS_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Deletes a scheduled job.
export const deleteScheduledJob = api<{ jobId: string }, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/scheduled-jobs/:jobId" },
  async (req) => {
    try {
      const result = await schedulerDB.exec`
        DELETE FROM scheduled_jobs WHERE id = ${req.jobId}
      `;

      return { success: true };
    } catch (error) {
      throw APIError.internal("Failed to delete scheduled job", {
        code: "DELETE_JOB_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Retrieves execution history for a scheduled job.
export const getJobExecutions = api<{ jobId: string; limit?: number; offset?: number }, JobExecutionsResponse>(
  { expose: true, method: "GET", path: "/scheduled-jobs/:jobId/executions" },
  async (req) => {
    try {
      const limit = req.limit || 50;
      const offset = req.offset || 0;

      const executions = await schedulerDB.queryAll`
        SELECT 
          id, job_id, started_at, completed_at, status, file_id, analysis_id,
          rows_fetched, error_message, execution_time_ms
        FROM job_executions
        WHERE job_id = ${req.jobId}
        ORDER BY started_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await schedulerDB.queryRow`
        SELECT COUNT(*) as total FROM job_executions WHERE job_id = ${req.jobId}
      `;

      const mappedExecutions: JobExecution[] = executions.map(exec => ({
        id: exec.id,
        jobId: exec.job_id,
        startedAt: new Date(exec.started_at),
        completedAt: exec.completed_at ? new Date(exec.completed_at) : undefined,
        status: exec.status,
        fileId: exec.file_id,
        analysisId: exec.analysis_id,
        rowsFetched: exec.rows_fetched,
        errorMessage: exec.error_message,
        executionTimeMs: exec.execution_time_ms
      }));

      return {
        executions: mappedExecutions,
        totalCount: parseInt(countResult?.total || '0')
      };
    } catch (error) {
      throw APIError.internal("Failed to retrieve job executions", {
        code: "GET_EXECUTIONS_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Retrieves historical analyses for a scheduled job.
export const getHistoricalAnalyses = api<{ jobId: string; limit?: number; offset?: number }, HistoricalAnalysesResponse>(
  { expose: true, method: "GET", path: "/scheduled-jobs/:jobId/analyses" },
  async (req) => {
    try {
      const limit = req.limit || 50;
      const offset = req.offset || 0;

      const analyses = await schedulerDB.queryAll`
        SELECT 
          id, job_id, file_id, execution_id, analysis_data, created_at,
          date_range_start, date_range_end, total_rows, key_metrics,
          insights_count, recommendations_count
        FROM historical_analyses
        WHERE job_id = ${req.jobId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const countResult = await schedulerDB.queryRow`
        SELECT COUNT(*) as total FROM historical_analyses WHERE job_id = ${req.jobId}
      `;

      const mappedAnalyses: HistoricalAnalysis[] = analyses.map(analysis => ({
        id: analysis.id,
        jobId: analysis.job_id,
        fileId: analysis.file_id,
        executionId: analysis.execution_id,
        analysisData: analysis.analysis_data,
        createdAt: new Date(analysis.created_at),
        dateRangeStart: analysis.date_range_start,
        dateRangeEnd: analysis.date_range_end,
        totalRows: analysis.total_rows,
        keyMetrics: analysis.key_metrics,
        insightsCount: analysis.insights_count,
        recommendationsCount: analysis.recommendations_count
      }));

      return {
        analyses: mappedAnalyses,
        totalCount: parseInt(countResult?.total || '0')
      };
    } catch (error) {
      throw APIError.internal("Failed to retrieve historical analyses", {
        code: "GET_ANALYSES_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Generates a trend comparison between two analyses.
export const generateTrendComparison = api<{ jobId: string; currentAnalysisId: string; previousAnalysisId: string }, TrendComparisonResponse>(
  { expose: true, method: "POST", path: "/scheduled-jobs/:jobId/trend-comparison" },
  async (req) => {
    try {
      // Get both analyses
      const currentAnalysis = await schedulerDB.queryRow`
        SELECT * FROM historical_analyses WHERE id = ${req.currentAnalysisId} AND job_id = ${req.jobId}
      `;

      const previousAnalysis = await schedulerDB.queryRow`
        SELECT * FROM historical_analyses WHERE id = ${req.previousAnalysisId} AND job_id = ${req.jobId}
      `;

      if (!currentAnalysis || !previousAnalysis) {
        throw APIError.notFound("Analysis not found", {
          code: "ANALYSIS_NOT_FOUND",
          message: "One or both analyses could not be found",
          suggestion: "Please check the analysis IDs"
        });
      }

      // Generate comparison data
      const comparisonData = generateComparisonData(currentAnalysis, previousAnalysis);
      
      // Store the comparison
      const comparisonId = await schedulerDB.queryRow`
        INSERT INTO trend_comparisons (
          job_id, current_analysis_id, previous_analysis_id, comparison_data,
          significant_changes, improvement_areas, decline_areas
        ) VALUES (
          ${req.jobId}, ${req.currentAnalysisId}, ${req.previousAnalysisId}, ${JSON.stringify(comparisonData)},
          ${comparisonData.significantChanges}, ${comparisonData.improvementAreas}, ${comparisonData.declineAreas}
        ) RETURNING id, created_at
      `;

      const comparison: TrendComparison = {
        id: comparisonId.id,
        jobId: req.jobId,
        currentAnalysisId: req.currentAnalysisId,
        previousAnalysisId: req.previousAnalysisId,
        comparisonData,
        createdAt: new Date(comparisonId.created_at),
        significantChanges: comparisonData.significantChanges,
        improvementAreas: comparisonData.improvementAreas,
        declineAreas: comparisonData.declineAreas
      };

      return {
        comparison,
        insights: comparisonData.insights || []
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to generate trend comparison", {
        code: "COMPARISON_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Manually triggers a scheduled job execution.
export const triggerJobExecution = api<{ jobId: string }, { executionId: number }>(
  { expose: true, method: "POST", path: "/scheduled-jobs/:jobId/trigger" },
  async (req) => {
    try {
      // Check if job exists and is active
      const job = await schedulerDB.queryRow`
        SELECT * FROM scheduled_jobs WHERE id = ${req.jobId}
      `;

      if (!job) {
        throw APIError.notFound("Scheduled job not found", {
          code: "JOB_NOT_FOUND",
          message: `No scheduled job found with ID: ${req.jobId}`,
          suggestion: "Please check the job ID"
        });
      }

      // Create execution record
      const execution = await schedulerDB.queryRow`
        INSERT INTO job_executions (job_id, status)
        VALUES (${req.jobId}, 'running')
        RETURNING id
      `;

      // Execute the job asynchronously
      executeScheduledJob(req.jobId, execution.id).catch(error => {
        console.error(`Failed to execute job ${req.jobId}:`, error);
      });

      return { executionId: execution.id };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to trigger job execution", {
        code: "TRIGGER_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Cron job endpoint to process scheduled jobs.
export const processScheduledJobs = api<void, { processed: number }>(
  { expose: false, method: "POST", path: "/internal/process-scheduled-jobs" },
  async () => {
    try {
      // Get jobs that are due to run
      const dueJobs = await schedulerDB.queryAll`
        SELECT id FROM scheduled_jobs 
        WHERE is_active = TRUE AND next_run <= NOW()
        ORDER BY next_run ASC
        LIMIT 10
      `;

      let processed = 0;

      for (const job of dueJobs) {
        try {
          // Create execution record
          const execution = await schedulerDB.queryRow`
            INSERT INTO job_executions (job_id, status)
            VALUES (${job.id}, 'running')
            RETURNING id
          `;

          // Execute job asynchronously
          executeScheduledJob(job.id, execution.id).catch(error => {
            console.error(`Failed to execute scheduled job ${job.id}:`, error);
          });

          processed++;
        } catch (error) {
          console.error(`Failed to start execution for job ${job.id}:`, error);
        }
      }

      return { processed };
    } catch (error) {
      console.error('Failed to process scheduled jobs:', error);
      return { processed: 0 };
    }
  }
);

function calculateNextRun(
  frequency: string,
  timeOfDay: string,
  dayOfWeek?: number,
  dayOfMonth?: number,
  timezone: string = 'UTC'
): Date {
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  
  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  switch (frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case 'weekly':
      if (dayOfWeek !== undefined) {
        const currentDay = nextRun.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        
        if (daysUntilTarget === 0 && nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 7);
        } else {
          nextRun.setDate(nextRun.getDate() + daysUntilTarget);
        }
      }
      break;

    case 'monthly':
      if (dayOfMonth !== undefined) {
        nextRun.setDate(dayOfMonth);
        
        if (nextRun <= now) {
          nextRun.setMonth(nextRun.getMonth() + 1);
          nextRun.setDate(dayOfMonth);
        }
      }
      break;
  }

  return nextRun;
}

function getDefaultPlatformConfig(platform: string) {
  const configs = {
    "google-analytics": {
      metrics: ["sessions", "totalUsers", "screenPageViews", "bounceRate", "sessionDuration"],
      dimensions: ["date", "country", "deviceCategory", "sessionDefaultChannelGroup"]
    },
    "google-ads": {
      metrics: ["metrics.impressions", "metrics.clicks", "metrics.cost_micros", "metrics.conversions", "metrics.ctr"],
      dimensions: ["segments.date", "campaign.name", "campaign.status"]
    },
    "facebook-ads": {
      metrics: ["impressions", "clicks", "spend", "conversions", "ctr"],
      dimensions: ["date_start", "campaign_name", "objective"]
    }
  };

  return configs[platform as keyof typeof configs] || configs["google-analytics"];
}

function generateComparisonData(currentAnalysis: any, previousAnalysis: any) {
  const currentMetrics = currentAnalysis.key_metrics || {};
  const previousMetrics = previousAnalysis.key_metrics || {};
  
  const insights: Array<{
    metric: string;
    currentValue: number;
    previousValue: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
    significance: "high" | "medium" | "low";
  }> = [];

  let significantChanges = 0;
  let improvementAreas = 0;
  let declineAreas = 0;

  // Compare metrics
  for (const [metric, currentValue] of Object.entries(currentMetrics)) {
    const previousValue = previousMetrics[metric];
    
    if (typeof currentValue === 'number' && typeof previousValue === 'number' && previousValue !== 0) {
      const change = currentValue - previousValue;
      const changePercent = (change / previousValue) * 100;
      
      let trend: "up" | "down" | "stable" = "stable";
      let significance: "high" | "medium" | "low" = "low";
      
      if (Math.abs(changePercent) > 20) {
        significance = "high";
        significantChanges++;
      } else if (Math.abs(changePercent) > 10) {
        significance = "medium";
      }
      
      if (changePercent > 5) {
        trend = "up";
        improvementAreas++;
      } else if (changePercent < -5) {
        trend = "down";
        declineAreas++;
      }
      
      insights.push({
        metric,
        currentValue,
        previousValue,
        change,
        changePercent,
        trend,
        significance
      });
    }
  }

  return {
    insights,
    significantChanges,
    improvementAreas,
    declineAreas,
    comparisonPeriod: {
      current: {
        start: currentAnalysis.date_range_start,
        end: currentAnalysis.date_range_end
      },
      previous: {
        start: previousAnalysis.date_range_start,
        end: previousAnalysis.date_range_end
      }
    }
  };
}

async function executeScheduledJob(jobId: string, executionId: number): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Get job details
    const job = await schedulerDB.queryRow`
      SELECT * FROM scheduled_jobs WHERE id = ${jobId}
    `;

    if (!job) {
      throw new Error('Job not found');
    }

    // Calculate date range based on frequency
    const { startDate, endDate } = calculateDateRange(job.frequency);

    // Fetch data from integration
    const { integrations } = await import("~encore/clients");
    
    let dataResponse;
    const metrics = JSON.parse(job.metrics || '[]');
    const dimensions = JSON.parse(job.dimensions || '[]');

    switch (job.platform) {
      case 'google-analytics':
        dataResponse = await integrations.getGAData({
          propertyId: job.account_id,
          accessToken: job.access_token,
          startDate,
          endDate,
          metrics,
          dimensions
        });
        break;
      case 'google-ads':
        dataResponse = await integrations.getAdsData({
          customerId: job.account_id,
          accessToken: job.access_token,
          startDate,
          endDate,
          metrics,
          dimensions
        });
        break;
      case 'facebook-ads':
        dataResponse = await integrations.getFacebookData({
          accountId: job.account_id,
          accessToken: job.access_token,
          startDate,
          endDate,
          metrics,
          dimensions
        });
        break;
      default:
        throw new Error(`Unsupported platform: ${job.platform}`);
    }

    // Store data as file
    const { integrations: integrationManager } = await import("~encore/clients");
    const fileResponse = await integrationManager.integrationManager.fetchData({
      platform: job.platform,
      accountId: job.account_id,
      accessToken: job.access_token,
      startDate,
      endDate,
      metrics,
      dimensions
    });

    // Update execution with file info
    await schedulerDB.exec`
      UPDATE job_executions 
      SET file_id = ${fileResponse.fileId}, rows_fetched = ${fileResponse.totalRows}
      WHERE id = ${executionId}
    `;

    let analysisId: string | null = null;

    // Run analysis if enabled
    if (job.auto_analyze) {
      const { dashboard } = await import("~encore/clients");
      const analysisResponse = await dashboard.analyze({
        fileId: fileResponse.fileId,
        reportType: job.platform === 'google-analytics' ? 'ga4' : 'ads',
        analysisType: job.analysis_type
      });

      // Generate analysis ID and store historical analysis
      analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await schedulerDB.exec`
        INSERT INTO historical_analyses (
          id, job_id, file_id, execution_id, analysis_data, date_range_start, date_range_end,
          total_rows, key_metrics, insights_count, recommendations_count
        ) VALUES (
          ${analysisId}, ${jobId}, ${fileResponse.fileId}, ${executionId}, ${JSON.stringify(analysisResponse)},
          ${startDate}, ${endDate}, ${fileResponse.totalRows}, ${JSON.stringify(analysisResponse.keyMetrics)},
          ${analysisResponse.insights.length}, ${analysisResponse.recommendations.length}
        )
      `;

      // Send notification if email is configured
      if (job.notification_email) {
        await sendNotificationEmail(job, analysisResponse, startDate, endDate);
      }
    }

    // Mark execution as completed
    const executionTime = Date.now() - startTime;
    await schedulerDB.exec`
      UPDATE job_executions 
      SET status = 'completed', completed_at = NOW(), analysis_id = ${analysisId}, execution_time_ms = ${executionTime}
      WHERE id = ${executionId}
    `;

    // Update job's last run and next run
    const nextRun = calculateNextRun(
      job.frequency,
      job.time_of_day,
      job.day_of_week,
      job.day_of_month,
      job.timezone
    );

    await schedulerDB.exec`
      UPDATE scheduled_jobs 
      SET last_run = NOW(), next_run = ${nextRun.toISOString()}
      WHERE id = ${jobId}
    `;

  } catch (error) {
    // Mark execution as failed
    const executionTime = Date.now() - startTime;
    await schedulerDB.exec`
      UPDATE job_executions 
      SET status = 'failed', completed_at = NOW(), error_message = ${error instanceof Error ? error.message : 'Unknown error'}, execution_time_ms = ${executionTime}
      WHERE id = ${executionId}
    `;

    throw error;
  }
}

function calculateDateRange(frequency: string): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  switch (frequency) {
    case 'daily':
      startDate.setDate(startDate.getDate() - 1);
      break;
    case 'weekly':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

async function sendNotificationEmail(job: any, analysis: any, startDate: string, endDate: string): Promise<void> {
  // This would integrate with an email service
  // For now, we'll just log the notification
  console.log(`Notification email would be sent to ${job.notification_email} for job ${job.name}`);
  console.log(`Analysis summary: ${analysis.summary}`);
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log(`Insights: ${analysis.insights.length}, Recommendations: ${analysis.recommendations.length}`);
}

// Cron job to execute scheduled jobs
const _ = new CronJob("process-scheduled-jobs", {
  title: "Process Scheduled Jobs",
  endpoint: processScheduledJobs,
  every: "1m", // Run every minute
});
