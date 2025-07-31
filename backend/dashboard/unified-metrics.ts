import { api, APIError } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { Bucket } from "encore.dev/storage/objects";

const metricsDB = new SQLDatabase("metrics", {
  migrations: "./migrations",
});

const reportsBucket = new Bucket("reports");

export interface MetricSource {
  id: string;
  name: string;
  type: "file" | "integration";
  platform?: "google-analytics" | "google-ads" | "facebook-ads" | "manual";
  uploadedAt: Date;
  lastAnalyzed?: Date;
  status: "active" | "processing" | "error";
  rowCount?: number;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface UnifiedMetric {
  sourceId: string;
  sourceName: string;
  platform: string;
  date: string;
  metricName: string;
  metricValue: number;
  metricType: "count" | "rate" | "currency" | "duration";
  category: "traffic" | "engagement" | "conversion" | "revenue" | "advertising";
}

export interface MetricComparison {
  metricName: string;
  sources: Array<{
    sourceId: string;
    sourceName: string;
    platform: string;
    value: number;
    change?: number;
    changePercent?: number;
  }>;
  totalValue: number;
  averageValue: number;
  bestPerforming: {
    sourceId: string;
    sourceName: string;
    value: number;
  };
}

export interface TimeSeriesData {
  date: string;
  sources: Record<string, number>;
  total: number;
}

export interface UnifiedDashboardRequest {
  sourceIds?: string[];
  startDate?: string;
  endDate?: string;
  metrics?: string[];
  groupBy?: "day" | "week" | "month";
}

export interface UnifiedDashboardResponse {
  sources: MetricSource[];
  keyMetrics: MetricComparison[];
  timeSeriesData: Record<string, TimeSeriesData[]>;
  summary: {
    totalSources: number;
    dateRange: {
      start: string;
      end: string;
    };
    topPerformingSource: {
      sourceId: string;
      sourceName: string;
      platform: string;
    };
    totalMetricsTracked: number;
  };
  insights: Array<{
    title: string;
    description: string;
    type: "trend" | "comparison" | "anomaly" | "opportunity";
    impact: "high" | "medium" | "low";
    sources: string[];
  }>;
}

export interface AddMetricSourceRequest {
  name: string;
  type: "file" | "integration";
  platform?: "google-analytics" | "google-ads" | "facebook-ads" | "manual";
  fileId?: string;
  integrationData?: {
    accountId: string;
    accessToken: string;
    startDate: string;
    endDate: string;
  };
}

export interface AddMetricSourceResponse {
  sourceId: string;
  status: "processing" | "completed" | "error";
  message: string;
}

// Retrieves unified dashboard data from all connected sources.
export const getUnifiedDashboard = api<UnifiedDashboardRequest, UnifiedDashboardResponse>(
  { expose: true, method: "POST", path: "/unified-dashboard" },
  async (req) => {
    try {
      // Get all metric sources or filter by provided IDs
      const sources = await fetchMetricSources(req.sourceIds);
      
      if (sources.length === 0) {
        return {
          sources: [],
          keyMetrics: [],
          timeSeriesData: {},
          summary: {
            totalSources: 0,
            dateRange: { start: "", end: "" },
            topPerformingSource: { sourceId: "", sourceName: "", platform: "" },
            totalMetricsTracked: 0
          },
          insights: []
        };
      }

      // Determine date range
      const dateRange = determineDateRange(sources, req.startDate, req.endDate);
      
      // Get unified metrics for the specified period
      const metrics = await getUnifiedMetrics(
        req.sourceIds || sources.map(s => s.id),
        dateRange.start,
        dateRange.end,
        req.metrics
      );

      // Generate metric comparisons
      const keyMetrics = generateMetricComparisons(metrics, sources);

      // Generate time series data
      const timeSeriesData = generateTimeSeriesData(metrics, req.groupBy || "day");

      // Generate insights
      const insights = generateUnifiedInsights(metrics, sources, keyMetrics);

      // Calculate summary
      const summary = calculateSummary(sources, metrics, dateRange);

      return {
        sources,
        keyMetrics,
        timeSeriesData,
        summary,
        insights
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to generate unified dashboard", {
        code: "DASHBOARD_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again or contact support"
      });
    }
  }
);

// Adds a new metric source to the unified dashboard.
export const addMetricSource = api<AddMetricSourceRequest, AddMetricSourceResponse>(
  { expose: true, method: "POST", path: "/unified-dashboard/sources" },
  async (req) => {
    try {
      const sourceId = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert source record
      await metricsDB.exec`
        INSERT INTO metric_sources (id, name, type, platform, status, created_at)
        VALUES (${sourceId}, ${req.name}, ${req.type}, ${req.platform || 'manual'}, 'processing', NOW())
      `;

      // Process the source data
      if (req.type === "file" && req.fileId) {
        await processFileSource(sourceId, req.fileId);
      } else if (req.type === "integration" && req.integrationData) {
        await processIntegrationSource(sourceId, req.integrationData, req.platform!);
      }

      return {
        sourceId,
        status: "processing",
        message: "Source added successfully and is being processed"
      };
    } catch (error) {
      throw APIError.internal("Failed to add metric source", {
        code: "ADD_SOURCE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please check your data and try again"
      });
    }
  }
);

// Lists all available metric sources.
export const getMetricSources = api<{ sourceIds?: string[] }, { sources: MetricSource[] }>(
  { expose: true, method: "POST", path: "/unified-dashboard/sources/list" },
  async (req) => {
    try {
      const sources = await fetchMetricSources(req.sourceIds);
      return { sources };
    } catch (error) {
      throw APIError.internal("Failed to retrieve metric sources", {
        code: "GET_SOURCES_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

// Removes a metric source from the unified dashboard.
export const removeMetricSource = api<{ sourceId: string }, { success: boolean }>(
  { expose: true, method: "DELETE", path: "/unified-dashboard/sources/:sourceId" },
  async (req) => {
    try {
      // Delete metrics data
      await metricsDB.exec`DELETE FROM unified_metrics WHERE source_id = ${req.sourceId}`;
      
      // Delete source record
      await metricsDB.exec`DELETE FROM metric_sources WHERE id = ${req.sourceId}`;

      return { success: true };
    } catch (error) {
      throw APIError.internal("Failed to remove metric source", {
        code: "REMOVE_SOURCE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        suggestion: "Please try again"
      });
    }
  }
);

async function fetchMetricSources(sourceIds?: string[]): Promise<MetricSource[]> {
  let query = `
    SELECT id, name, type, platform, status, created_at, last_analyzed, row_count, date_range_start, date_range_end
    FROM metric_sources
  `;
  
  const params: any[] = [];
  
  if (sourceIds && sourceIds.length > 0) {
    query += ` WHERE id = ANY($1)`;
    params.push(sourceIds);
  }
  
  query += ` ORDER BY created_at DESC`;

  const rows = await metricsDB.queryAll(query, ...params);
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    type: row.type,
    platform: row.platform,
    uploadedAt: new Date(row.created_at),
    lastAnalyzed: row.last_analyzed ? new Date(row.last_analyzed) : undefined,
    status: row.status,
    rowCount: row.row_count,
    dateRange: row.date_range_start && row.date_range_end ? {
      start: row.date_range_start,
      end: row.date_range_end
    } : undefined
  }));
}

async function getUnifiedMetrics(
  sourceIds: string[],
  startDate: string,
  endDate: string,
  metricNames?: string[]
): Promise<UnifiedMetric[]> {
  let query = `
    SELECT source_id, source_name, platform, date, metric_name, metric_value, metric_type, category
    FROM unified_metrics
    WHERE source_id = ANY($1) AND date >= $2 AND date <= $3
  `;
  
  const params: any[] = [sourceIds, startDate, endDate];
  
  if (metricNames && metricNames.length > 0) {
    query += ` AND metric_name = ANY($4)`;
    params.push(metricNames);
  }
  
  query += ` ORDER BY date, source_id, metric_name`;

  const rows = await metricsDB.queryAll(query, ...params);
  
  return rows.map(row => ({
    sourceId: row.source_id,
    sourceName: row.source_name,
    platform: row.platform,
    date: row.date,
    metricName: row.metric_name,
    metricValue: parseFloat(row.metric_value),
    metricType: row.metric_type,
    category: row.category
  }));
}

function determineDateRange(
  sources: MetricSource[],
  requestedStart?: string,
  requestedEnd?: string
): { start: string; end: string } {
  if (requestedStart && requestedEnd) {
    return { start: requestedStart, end: requestedEnd };
  }

  // Find the common date range across all sources
  const dateRanges = sources
    .filter(s => s.dateRange)
    .map(s => s.dateRange!);

  if (dateRanges.length === 0) {
    // Default to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  const latestStart = dateRanges
    .map(r => new Date(r.start))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const earliestEnd = dateRanges
    .map(r => new Date(r.end))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return {
    start: requestedStart || latestStart.toISOString().split('T')[0],
    end: requestedEnd || earliestEnd.toISOString().split('T')[0]
  };
}

function generateMetricComparisons(
  metrics: UnifiedMetric[],
  sources: MetricSource[]
): MetricComparison[] {
  const metricGroups = new Map<string, UnifiedMetric[]>();
  
  // Group metrics by name
  metrics.forEach(metric => {
    if (!metricGroups.has(metric.metricName)) {
      metricGroups.set(metric.metricName, []);
    }
    metricGroups.get(metric.metricName)!.push(metric);
  });

  const comparisons: MetricComparison[] = [];

  metricGroups.forEach((metricList, metricName) => {
    const sourceValues = new Map<string, number>();
    
    // Sum values by source
    metricList.forEach(metric => {
      const current = sourceValues.get(metric.sourceId) || 0;
      sourceValues.set(metric.sourceId, current + metric.metricValue);
    });

    const sourceComparisons = Array.from(sourceValues.entries()).map(([sourceId, value]) => {
      const source = sources.find(s => s.id === sourceId);
      return {
        sourceId,
        sourceName: source?.name || 'Unknown',
        platform: source?.platform || 'unknown',
        value
      };
    });

    const totalValue = sourceComparisons.reduce((sum, s) => sum + s.value, 0);
    const averageValue = totalValue / sourceComparisons.length;
    const bestPerforming = sourceComparisons.reduce((best, current) => 
      current.value > best.value ? current : best
    );

    comparisons.push({
      metricName,
      sources: sourceComparisons,
      totalValue,
      averageValue,
      bestPerforming: {
        sourceId: bestPerforming.sourceId,
        sourceName: bestPerforming.sourceName,
        value: bestPerforming.value
      }
    });
  });

  return comparisons.sort((a, b) => b.totalValue - a.totalValue);
}

function generateTimeSeriesData(
  metrics: UnifiedMetric[],
  groupBy: "day" | "week" | "month"
): Record<string, TimeSeriesData[]> {
  const timeSeriesMap = new Map<string, Map<string, Map<string, number>>>();

  // Group metrics by metric name, then by date, then by source
  metrics.forEach(metric => {
    const date = formatDateForGrouping(metric.date, groupBy);
    
    if (!timeSeriesMap.has(metric.metricName)) {
      timeSeriesMap.set(metric.metricName, new Map());
    }
    
    const metricMap = timeSeriesMap.get(metric.metricName)!;
    if (!metricMap.has(date)) {
      metricMap.set(date, new Map());
    }
    
    const dateMap = metricMap.get(date)!;
    const current = dateMap.get(metric.sourceId) || 0;
    dateMap.set(metric.sourceId, current + metric.metricValue);
  });

  const result: Record<string, TimeSeriesData[]> = {};

  timeSeriesMap.forEach((dateMap, metricName) => {
    const timeSeriesData: TimeSeriesData[] = [];
    
    dateMap.forEach((sourceMap, date) => {
      const sources: Record<string, number> = {};
      let total = 0;
      
      sourceMap.forEach((value, sourceId) => {
        sources[sourceId] = value;
        total += value;
      });
      
      timeSeriesData.push({
        date,
        sources,
        total
      });
    });
    
    // Sort by date
    timeSeriesData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    result[metricName] = timeSeriesData;
  });

  return result;
}

function formatDateForGrouping(date: string, groupBy: "day" | "week" | "month"): string {
  const d = new Date(date);
  
  switch (groupBy) {
    case "day":
      return d.toISOString().split('T')[0];
    case "week":
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return weekStart.toISOString().split('T')[0];
    case "month":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      return d.toISOString().split('T')[0];
  }
}

function generateUnifiedInsights(
  metrics: UnifiedMetric[],
  sources: MetricSource[],
  comparisons: MetricComparison[]
): Array<{
  title: string;
  description: string;
  type: "trend" | "comparison" | "anomaly" | "opportunity";
  impact: "high" | "medium" | "low";
  sources: string[];
}> {
  const insights: Array<{
    title: string;
    description: string;
    type: "trend" | "comparison" | "anomaly" | "opportunity";
    impact: "high" | "medium" | "low";
    sources: string[];
  }> = [];

  // Cross-platform performance comparison
  if (comparisons.length > 0) {
    const topMetric = comparisons[0];
    if (topMetric.sources.length > 1) {
      const bestSource = topMetric.bestPerforming;
      const worstSource = topMetric.sources.reduce((worst, current) => 
        current.value < worst.value ? current : worst
      );
      
      const performanceGap = ((bestSource.value - worstSource.value) / worstSource.value) * 100;
      
      if (performanceGap > 50) {
        insights.push({
          title: `Significant Performance Gap in ${topMetric.metricName}`,
          description: `${bestSource.sourceName} (${bestSource.platform}) is outperforming ${worstSource.sourceName} (${worstSource.platform}) by ${performanceGap.toFixed(1)}%. Consider analyzing the strategies used in the top-performing source.`,
          type: "comparison",
          impact: "high",
          sources: [bestSource.sourceId, worstSource.sourceId]
        });
      }
    }
  }

  // Platform diversity insight
  const platformCounts = new Map<string, number>();
  sources.forEach(source => {
    const platform = source.platform || 'unknown';
    platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
  });

  if (platformCounts.size === 1 && sources.length > 1) {
    const platform = Array.from(platformCounts.keys())[0];
    insights.push({
      title: "Single Platform Dependency",
      description: `All your data sources are from ${platform}. Consider diversifying your marketing channels to reduce dependency and discover new opportunities.`,
      type: "opportunity",
      impact: "medium",
      sources: sources.map(s => s.id)
    });
  }

  // Data freshness insight
  const outdatedSources = sources.filter(source => {
    if (!source.lastAnalyzed) return true;
    const daysSinceUpdate = (Date.now() - source.lastAnalyzed.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7;
  });

  if (outdatedSources.length > 0) {
    insights.push({
      title: "Outdated Data Sources",
      description: `${outdatedSources.length} data source(s) haven't been updated in over a week. Regular updates ensure accurate insights and trend analysis.`,
      type: "anomaly",
      impact: "medium",
      sources: outdatedSources.map(s => s.id)
    });
  }

  return insights;
}

function calculateSummary(
  sources: MetricSource[],
  metrics: UnifiedMetric[],
  dateRange: { start: string; end: string }
): {
  totalSources: number;
  dateRange: { start: string; end: string };
  topPerformingSource: { sourceId: string; sourceName: string; platform: string };
  totalMetricsTracked: number;
} {
  // Calculate total metrics per source
  const sourceMetrics = new Map<string, number>();
  metrics.forEach(metric => {
    const current = sourceMetrics.get(metric.sourceId) || 0;
    sourceMetrics.set(metric.sourceId, current + metric.metricValue);
  });

  // Find top performing source
  let topPerformingSource = { sourceId: "", sourceName: "", platform: "" };
  let maxValue = 0;

  sourceMetrics.forEach((value, sourceId) => {
    if (value > maxValue) {
      maxValue = value;
      const source = sources.find(s => s.id === sourceId);
      if (source) {
        topPerformingSource = {
          sourceId: source.id,
          sourceName: source.name,
          platform: source.platform || 'unknown'
        };
      }
    }
  });

  // Count unique metrics
  const uniqueMetrics = new Set(metrics.map(m => m.metricName));

  return {
    totalSources: sources.length,
    dateRange,
    topPerformingSource,
    totalMetricsTracked: uniqueMetrics.size
  };
}

async function processFileSource(sourceId: string, fileId: string): Promise<void> {
  try {
    // This would integrate with the existing analyze endpoint
    // For now, we'll simulate the processing
    await metricsDB.exec`
      UPDATE metric_sources 
      SET status = 'completed', last_analyzed = NOW(), row_count = 100
      WHERE id = ${sourceId}
    `;
  } catch (error) {
    await metricsDB.exec`
      UPDATE metric_sources 
      SET status = 'error'
      WHERE id = ${sourceId}
    `;
    throw error;
  }
}

async function processIntegrationSource(
  sourceId: string,
  integrationData: any,
  platform: string
): Promise<void> {
  try {
    // This would integrate with the existing integration endpoints
    // For now, we'll simulate the processing
    await metricsDB.exec`
      UPDATE metric_sources 
      SET status = 'completed', last_analyzed = NOW(), row_count = 250,
          date_range_start = ${integrationData.startDate},
          date_range_end = ${integrationData.endDate}
      WHERE id = ${sourceId}
    `;
  } catch (error) {
    await metricsDB.exec`
      UPDATE metric_sources 
      SET status = 'error'
      WHERE id = ${sourceId}
    `;
    throw error;
  }
}
