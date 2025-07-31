import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";
import { secret } from "encore.dev/config";

const reportsBucket = new Bucket("reports");
const openAIKey = secret("OpenAIKey");

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface FilterOptions {
  dateRange?: DateRange;
  selectedMetrics?: string[];
  selectedCategories?: string[];
  minValue?: number;
  maxValue?: number;
}

export interface AnalyzeRequest {
  fileId: string;
  reportType: "ga4" | "ads" | "general";
  analysisType: "insights" | "recommendations" | "summary";
  filters?: FilterOptions;
}

export interface Insight {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  metrics?: Record<string, number>;
}

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  expectedImpact: string;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  date?: string;
  category?: string;
}

export interface ChartData {
  type: "line" | "bar" | "pie" | "area";
  title: string;
  data: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
  colors?: string[];
}

export interface DataSummary {
  totalRows: number;
  filteredRows: number;
  dateRange: {
    earliest?: string;
    latest?: string;
  };
  availableMetrics: string[];
  availableCategories: string[];
}

export interface AnalyzeResponse {
  insights: Insight[];
  recommendations: Recommendation[];
  summary: string;
  keyMetrics: Record<string, number>;
  charts: ChartData[];
  dataSummary: DataSummary;
  rawData: {
    headers: string[];
    rows: string[][];
  };
}

// Analyzes uploaded report data using AI to generate insights and recommendations.
export const analyze = api<AnalyzeRequest, AnalyzeResponse>(
  { expose: true, method: "POST", path: "/analyze" },
  async (req) => {
    try {
      // Validate input parameters
      if (!req.fileId || !req.reportType || !req.analysisType) {
        throw APIError.invalidArgument("Missing required parameters", {
          code: "MISSING_PARAMETERS",
          message: "File ID, report type, and analysis type are required",
          suggestion: "Please ensure all analysis parameters are provided"
        });
      }

      // Validate enum values
      const validReportTypes = ["ga4", "ads", "general"];
      const validAnalysisTypes = ["insights", "recommendations", "summary"];
      
      if (!validReportTypes.includes(req.reportType)) {
        throw APIError.invalidArgument("Invalid report type", {
          code: "INVALID_REPORT_TYPE",
          message: `Report type '${req.reportType}' is not supported`,
          suggestion: `Please use one of: ${validReportTypes.join(', ')}`
        });
      }

      if (!validAnalysisTypes.includes(req.analysisType)) {
        throw APIError.invalidArgument("Invalid analysis type", {
          code: "INVALID_ANALYSIS_TYPE",
          message: `Analysis type '${req.analysisType}' is not supported`,
          suggestion: `Please use one of: ${validAnalysisTypes.join(', ')}`
        });
      }

      // Find and download the file from storage
      let fileName = "";
      let fileFound = false;
      
      try {
        const files = reportsBucket.list({ prefix: req.fileId });
        for await (const file of files) {
          fileName = file.name;
          fileFound = true;
          break;
        }
      } catch (error) {
        throw APIError.internal("Storage access failed", {
          code: "STORAGE_ACCESS_ERROR",
          message: "Unable to access file storage",
          suggestion: "Please try again. If the problem persists, contact support"
        });
      }
      
      if (!fileFound || !fileName) {
        throw APIError.notFound("File not found", {
          code: "FILE_NOT_FOUND",
          message: `No file found with ID: ${req.fileId}`,
          suggestion: "Please upload a new file or check that the file ID is correct"
        });
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = await reportsBucket.download(fileName);
      } catch (error) {
        throw APIError.internal("File download failed", {
          code: "DOWNLOAD_ERROR",
          message: "Unable to download the file from storage",
          suggestion: "The file may be corrupted. Please try uploading again"
        });
      }

      // Parse CSV data with error handling
      let csvContent: string;
      let headers: string[];
      let rows: string[][];

      try {
        csvContent = fileBuffer.toString('utf-8');
        const parseResult = parseCSVContent(csvContent);
        headers = parseResult.headers;
        rows = parseResult.rows;
      } catch (error) {
        if (error instanceof Error) {
          throw APIError.invalidArgument("CSV parsing failed", {
            code: "CSV_PARSE_ERROR",
            message: error.message,
            suggestion: "Please ensure your file is a valid CSV with proper formatting"
          });
        }
        throw APIError.internal("Unexpected parsing error");
      }

      // Validate parsed data
      if (headers.length === 0) {
        throw APIError.invalidArgument("No data columns found", {
          code: "NO_COLUMNS",
          message: "The file does not contain any recognizable data columns",
          suggestion: "Please ensure your CSV file has a header row with column names"
        });
      }

      if (rows.length === 0) {
        throw APIError.invalidArgument("No data rows found", {
          code: "NO_DATA_ROWS",
          message: "The file does not contain any data rows",
          suggestion: "Please ensure your CSV file contains data below the header row"
        });
      }

      if (rows.length < 2) {
        throw APIError.invalidArgument("Insufficient data for analysis", {
          code: "INSUFFICIENT_DATA",
          message: "At least 2 data rows are required for meaningful analysis",
          suggestion: "Please upload a file with more data points"
        });
      }

      // Apply filters to the data
      const originalRowCount = rows.length;
      const filteredData = applyFilters(headers, rows, req.filters);
      const filteredRows = filteredData.rows;

      if (filteredRows.length === 0) {
        throw APIError.invalidArgument("No data matches the applied filters", {
          code: "NO_FILTERED_DATA",
          message: "The applied filters resulted in no matching data",
          suggestion: "Please adjust your filter criteria to include more data"
        });
      }

      // Create data summary
      const dataSummary = createDataSummary(headers, rows, filteredRows, req.filters);

      // Generate chart data from the filtered CSV
      const charts = generateChartData(headers, filteredRows, req.reportType);

      // Generate AI analysis with error handling
      let aiResponse: string;
      try {
        const analysisPrompt = createAnalysisPrompt(
          req.reportType, 
          req.analysisType, 
          headers, 
          filteredRows.slice(0, 10),
          req.filters
        );
        aiResponse = await callOpenAI(analysisPrompt);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('API key')) {
            throw APIError.internal("AI service configuration error", {
              code: "AI_CONFIG_ERROR",
              message: "AI analysis service is not properly configured",
              suggestion: "Please contact support to resolve this issue"
            });
          }
          if (error.message.includes('rate limit') || error.message.includes('quota')) {
            throw APIError.resourceExhausted("AI service temporarily unavailable", {
              code: "AI_RATE_LIMIT",
              message: "AI analysis service is currently at capacity",
              suggestion: "Please try again in a few minutes"
            });
          }
          if (error.message.includes('timeout')) {
            throw APIError.deadlineExceeded("AI analysis timeout", {
              code: "AI_TIMEOUT",
              message: "AI analysis took too long to complete",
              suggestion: "Please try again with a smaller dataset"
            });
          }
        }
        throw APIError.internal("AI analysis failed", {
          code: "AI_ERROR",
          message: "Unable to generate AI analysis",
          suggestion: "Please try again. If the problem persists, contact support"
        });
      }

      // Parse AI response with fallback
      let analysisResult: Omit<AnalyzeResponse, 'charts' | 'rawData' | 'dataSummary'>;
      try {
        analysisResult = parseAIResponse(aiResponse, headers, filteredRows);
      } catch (error) {
        // Return fallback analysis if AI parsing fails
        analysisResult = createFallbackAnalysis(headers, filteredRows, req.reportType);
      }

      return {
        ...analysisResult,
        charts,
        dataSummary,
        rawData: {
          headers,
          rows: filteredRows
        }
      };
    } catch (error) {
      // Re-throw APIErrors as-is
      if (error instanceof APIError) {
        throw error;
      }

      // Handle unexpected errors
      throw APIError.internal("Analysis processing failed", {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred during analysis",
        suggestion: "Please try again. If the problem persists, contact support"
      });
    }
  }
);

interface ParseResult {
  headers: string[];
  rows: string[][];
}

interface FilteredData {
  rows: string[][];
  appliedFilters: string[];
}

function parseCSVContent(csvContent: string): ParseResult {
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error("CSV content is empty");
  }

  // Handle different line endings
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    throw new Error("No valid lines found in CSV");
  }

  // Parse headers
  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error("Header line is missing");
  }

  const headers = parseCSVLine(headerLine);
  if (headers.length === 0) {
    throw new Error("No headers found in first line");
  }

  // Check for duplicate headers
  const headerSet = new Set();
  const duplicates: string[] = [];
  headers.forEach(header => {
    if (headerSet.has(header.toLowerCase())) {
      duplicates.push(header);
    }
    headerSet.add(header.toLowerCase());
  });

  if (duplicates.length > 0) {
    throw new Error(`Duplicate column headers found: ${duplicates.join(', ')}`);
  }

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseCSVLine(lines[i]);
      if (row.length !== headers.length) {
        throw new Error(`Row ${i + 1} has ${row.length} columns but expected ${headers.length}`);
      }
      rows.push(row);
    } catch (error) {
      throw new Error(`Error parsing row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  
  return result;
}

function applyFilters(headers: string[], rows: string[][], filters?: FilterOptions): FilteredData {
  if (!filters) {
    return { rows, appliedFilters: [] };
  }

  let filteredRows = [...rows];
  const appliedFilters: string[] = [];

  // Apply date range filter
  if (filters.dateRange?.startDate || filters.dateRange?.endDate) {
    const dateColumns = findDateColumns(headers);
    if (dateColumns.length > 0) {
      const dateColIndex = headers.indexOf(dateColumns[0]);
      const startDate = filters.dateRange.startDate ? new Date(filters.dateRange.startDate) : null;
      const endDate = filters.dateRange.endDate ? new Date(filters.dateRange.endDate) : null;

      filteredRows = filteredRows.filter(row => {
        const dateValue = row[dateColIndex];
        if (!dateValue) return true;

        try {
          const rowDate = new Date(dateValue);
          if (isNaN(rowDate.getTime())) return true;

          if (startDate && rowDate < startDate) return false;
          if (endDate && rowDate > endDate) return false;
          return true;
        } catch {
          return true;
        }
      });

      appliedFilters.push(`Date range: ${filters.dateRange.startDate || 'start'} to ${filters.dateRange.endDate || 'end'}`);
    }
  }

  // Apply metric filters (selected metrics)
  if (filters.selectedMetrics && filters.selectedMetrics.length > 0) {
    // This filter affects which columns are considered for analysis
    // The actual filtering is handled in the analysis logic
    appliedFilters.push(`Selected metrics: ${filters.selectedMetrics.join(', ')}`);
  }

  // Apply category filters
  if (filters.selectedCategories && filters.selectedCategories.length > 0) {
    const categoricalColumns = findCategoricalColumns(headers, rows);
    if (categoricalColumns.length > 0) {
      const categoryColIndex = headers.indexOf(categoricalColumns[0]);
      
      filteredRows = filteredRows.filter(row => {
        const categoryValue = row[categoryColIndex];
        return !categoryValue || filters.selectedCategories!.includes(categoryValue);
      });

      appliedFilters.push(`Categories: ${filters.selectedCategories.join(', ')}`);
    }
  }

  // Apply value range filters
  if (filters.minValue !== undefined || filters.maxValue !== undefined) {
    const numericColumns = findNumericColumns(headers, rows);
    if (numericColumns.length > 0) {
      const primaryMetricIndex = headers.indexOf(numericColumns[0]);
      
      filteredRows = filteredRows.filter(row => {
        const value = parseNumericValue(row[primaryMetricIndex]);
        if (isNaN(value)) return true;

        if (filters.minValue !== undefined && value < filters.minValue) return false;
        if (filters.maxValue !== undefined && value > filters.maxValue) return false;
        return true;
      });

      const rangeDesc = [];
      if (filters.minValue !== undefined) rangeDesc.push(`min: ${filters.minValue}`);
      if (filters.maxValue !== undefined) rangeDesc.push(`max: ${filters.maxValue}`);
      appliedFilters.push(`Value range: ${rangeDesc.join(', ')}`);
    }
  }

  return { rows: filteredRows, appliedFilters };
}

function createDataSummary(
  headers: string[], 
  originalRows: string[][], 
  filteredRows: string[][],
  filters?: FilterOptions
): DataSummary {
  const dateColumns = findDateColumns(headers);
  const numericColumns = findNumericColumns(headers, originalRows);
  const categoricalColumns = findCategoricalColumns(headers, originalRows);

  let dateRange: { earliest?: string; latest?: string } = {};

  // Calculate date range from filtered data
  if (dateColumns.length > 0) {
    const dateColIndex = headers.indexOf(dateColumns[0]);
    const dates = filteredRows
      .map(row => row[dateColIndex])
      .filter(date => date && !isNaN(new Date(date).getTime()))
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length > 0) {
      dateRange.earliest = dates[0].toISOString().split('T')[0];
      dateRange.latest = dates[dates.length - 1].toISOString().split('T')[0];
    }
  }

  // Get available categories from original data
  const availableCategories: string[] = [];
  if (categoricalColumns.length > 0) {
    const categoryColIndex = headers.indexOf(categoricalColumns[0]);
    const categories = new Set(originalRows.map(row => row[categoryColIndex]).filter(Boolean));
    availableCategories.push(...Array.from(categories).sort());
  }

  return {
    totalRows: originalRows.length,
    filteredRows: filteredRows.length,
    dateRange,
    availableMetrics: numericColumns,
    availableCategories
  };
}

function generateChartData(headers: string[], rows: string[][], reportType: string): ChartData[] {
  const charts: ChartData[] = [];

  // Find date columns
  const dateColumns = findDateColumns(headers);
  
  // Find numeric columns
  const numericColumns = findNumericColumns(headers, rows);
  
  // Find categorical columns
  const categoricalColumns = findCategoricalColumns(headers, rows);

  // Generate time series charts if date column exists
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    const dateCol = dateColumns[0];
    const dateIndex = headers.indexOf(dateCol);
    
    // Create line charts for each numeric metric over time
    numericColumns.slice(0, 3).forEach(numericCol => {
      const numericIndex = headers.indexOf(numericCol);
      const timeSeriesData: ChartDataPoint[] = [];
      
      rows.forEach(row => {
        const dateValue = row[dateIndex];
        const numericValue = parseNumericValue(row[numericIndex]);
        
        if (dateValue && !isNaN(numericValue)) {
          timeSeriesData.push({
            label: formatDateLabel(dateValue),
            value: numericValue,
            date: dateValue
          });
        }
      });

      if (timeSeriesData.length > 1) {
        // Sort by date
        timeSeriesData.sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime());
        
        charts.push({
          type: "line",
          title: `${numericCol} Over Time`,
          data: timeSeriesData,
          xAxisLabel: "Date",
          yAxisLabel: numericCol,
          colors: ["#3b82f6"]
        });
      }
    });
  }

  // Generate bar charts for top performers
  if (numericColumns.length > 0) {
    const primaryMetric = numericColumns[0];
    const metricIndex = headers.indexOf(primaryMetric);
    
    // Find a good grouping column (categorical or text)
    const groupingCol = categoricalColumns[0] || headers.find(h => 
      !numericColumns.includes(h) && !dateColumns.includes(h)
    );
    
    if (groupingCol) {
      const groupingIndex = headers.indexOf(groupingCol);
      const groupedData: Record<string, number> = {};
      
      rows.forEach(row => {
        const group = row[groupingIndex];
        const value = parseNumericValue(row[metricIndex]);
        
        if (group && !isNaN(value)) {
          groupedData[group] = (groupedData[group] || 0) + value;
        }
      });

      const barData = Object.entries(groupedData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([label, value]) => ({
          label: label.length > 20 ? label.substring(0, 20) + '...' : label,
          value
        }));

      if (barData.length > 1) {
        charts.push({
          type: "bar",
          title: `Top ${groupingCol} by ${primaryMetric}`,
          data: barData,
          xAxisLabel: groupingCol,
          yAxisLabel: primaryMetric,
          colors: ["#10b981"]
        });
      }
    }
  }

  // Generate pie chart for categorical breakdown
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    const categoryCol = categoricalColumns[0];
    const valueCol = numericColumns[0];
    const categoryIndex = headers.indexOf(categoryCol);
    const valueIndex = headers.indexOf(valueCol);
    
    const categoryData: Record<string, number> = {};
    
    rows.forEach(row => {
      const category = row[categoryIndex];
      const value = parseNumericValue(row[valueIndex]);
      
      if (category && !isNaN(value)) {
        categoryData[category] = (categoryData[category] || 0) + value;
      }
    });

    const pieData = Object.entries(categoryData)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([label, value]) => ({
        label: label.length > 15 ? label.substring(0, 15) + '...' : label,
        value
      }));

    if (pieData.length > 1) {
      charts.push({
        type: "pie",
        title: `${valueCol} Distribution by ${categoryCol}`,
        data: pieData,
        colors: [
          "#3b82f6", "#ef4444", "#10b981", "#f59e0b", 
          "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"
        ]
      });
    }
  }

  // Generate comparison chart for multiple metrics
  if (numericColumns.length > 1) {
    const comparisonData = numericColumns.slice(0, 5).map(col => {
      const colIndex = headers.indexOf(col);
      const total = rows.reduce((sum, row) => {
        const value = parseNumericValue(row[colIndex]);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
      
      return {
        label: col.length > 15 ? col.substring(0, 15) + '...' : col,
        value: total
      };
    });

    if (comparisonData.length > 1) {
      charts.push({
        type: "bar",
        title: "Metrics Comparison",
        data: comparisonData,
        xAxisLabel: "Metrics",
        yAxisLabel: "Total Value",
        colors: ["#6366f1"]
      });
    }
  }

  return charts;
}

function findDateColumns(headers: string[]): string[] {
  const dateKeywords = ['date', 'time', 'day', 'month', 'year', 'created', 'updated', 'timestamp'];
  return headers.filter(header => {
    const lower = header.toLowerCase();
    return dateKeywords.some(keyword => lower.includes(keyword));
  });
}

function findNumericColumns(headers: string[], rows: string[][]): string[] {
  const numericKeywords = [
    'count', 'total', 'sum', 'amount', 'value', 'price', 'cost', 'revenue', 'sales',
    'clicks', 'impressions', 'views', 'sessions', 'users', 'conversion', 'rate',
    'ctr', 'cpc', 'cpm', 'roas', 'roi', 'bounce', 'duration', 'pages', 'goal'
  ];

  return headers.filter((header, index) => {
    const lower = header.toLowerCase();
    
    // Check if header contains numeric keywords
    const hasNumericKeyword = numericKeywords.some(keyword => lower.includes(keyword));
    
    // Check if most values in this column are numeric
    const sampleSize = Math.min(10, rows.length);
    const numericCount = rows.slice(0, sampleSize).reduce((count, row) => {
      const value = row[index];
      if (!value) return count;
      const cleaned = value.replace(/[$,%]/g, '');
      return !isNaN(parseFloat(cleaned)) ? count + 1 : count;
    }, 0);
    
    const isNumericColumn = numericCount > sampleSize * 0.7;
    
    return hasNumericKeyword || isNumericColumn;
  });
}

function findCategoricalColumns(headers: string[], rows: string[][]): string[] {
  const categoricalKeywords = [
    'category', 'type', 'source', 'medium', 'campaign', 'channel', 'device',
    'browser', 'country', 'region', 'city', 'gender', 'age', 'segment',
    'status', 'group', 'class', 'tag', 'label'
  ];

  return headers.filter((header, index) => {
    const lower = header.toLowerCase();
    
    // Check if header contains categorical keywords
    const hasCategoricalKeyword = categoricalKeywords.some(keyword => lower.includes(keyword));
    
    // Check if column has reasonable number of unique values (not too many, not too few)
    const sampleSize = Math.min(20, rows.length);
    const uniqueValues = new Set(rows.slice(0, sampleSize).map(row => row[index]));
    const isGoodCategorical = uniqueValues.size > 1 && uniqueValues.size < sampleSize * 0.8;
    
    return hasCategoricalKeyword || isGoodCategorical;
  });
}

function parseNumericValue(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,%]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function createAnalysisPrompt(
  reportType: string, 
  analysisType: string, 
  headers: string[], 
  sampleRows: string[][],
  filters?: FilterOptions
): string {
  const dataPreview = sampleRows.slice(0, 5).map(row => 
    headers.map((header, i) => `${header}: ${row[i] || 'N/A'}`).join(', ')
  ).join('\n');

  let filterContext = '';
  if (filters) {
    const filterParts: string[] = [];
    if (filters.dateRange?.startDate || filters.dateRange?.endDate) {
      filterParts.push(`Date range: ${filters.dateRange.startDate || 'start'} to ${filters.dateRange.endDate || 'end'}`);
    }
    if (filters.selectedMetrics?.length) {
      filterParts.push(`Focus metrics: ${filters.selectedMetrics.join(', ')}`);
    }
    if (filters.selectedCategories?.length) {
      filterParts.push(`Selected categories: ${filters.selectedCategories.join(', ')}`);
    }
    if (filters.minValue !== undefined || filters.maxValue !== undefined) {
      filterParts.push(`Value range: ${filters.minValue || 'min'} to ${filters.maxValue || 'max'}`);
    }
    
    if (filterParts.length > 0) {
      filterContext = `\n\nApplied filters: ${filterParts.join(', ')}`;
    }
  }

  return `
Analyze this ${reportType} report data and provide ${analysisType}.

Headers: ${headers.join(', ')}

Sample data (first 5 rows):
${dataPreview}

Total rows in filtered dataset: ${sampleRows.length}${filterContext}

Please provide a JSON response with the following structure:
{
  "insights": [
    {
      "category": "Performance|Traffic|Conversion|Revenue|Engagement",
      "title": "Brief insight title",
      "description": "Detailed explanation of what the data shows",
      "impact": "high|medium|low",
      "metrics": {"metric_name": numeric_value}
    }
  ],
  "recommendations": [
    {
      "title": "Actionable recommendation title",
      "description": "Specific steps to take based on the data",
      "priority": "high|medium|low",
      "effort": "low|medium|high",
      "expectedImpact": "Expected outcome description"
    }
  ],
  "summary": "Executive summary of key findings and overall performance",
  "keyMetrics": {"metric_name": numeric_value}
}

Focus on:
1. Actionable insights based on actual data patterns
2. Specific, implementable recommendations
3. Quantifiable metrics where possible
4. Clear explanations of what the data means for business decisions
${filterContext ? '5. Consider the applied filters when providing insights' : ''}

Ensure all numeric values in metrics are actual numbers, not strings.
`;
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = openAIKey();
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing analytics expert. Analyze data and provide actionable insights in valid JSON format only. Do not include any text outside the JSON response.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid OpenAI API key");
      }
      if (response.status === 429) {
        throw new Error("OpenAI rate limit exceeded");
      }
      if (response.status >= 500) {
        throw new Error("OpenAI service temporarily unavailable");
      }
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from OpenAI");
    }

    return data.choices[0].message.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error("OpenAI request timeout");
    }
    throw error;
  }
}

function parseAIResponse(aiResponse: string, headers: string[], rows: string[][]): Omit<AnalyzeResponse, 'charts' | 'rawData' | 'dataSummary'> {
  if (!aiResponse || aiResponse.trim().length === 0) {
    throw new Error("Empty AI response");
  }

  // Extract JSON from the response
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in AI response");
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error("Invalid JSON in AI response");
  }

  // Validate response structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error("AI response is not a valid object");
  }

  // Calculate basic metrics from the data
  const keyMetrics: Record<string, number> = {};
  
  // Find common metric columns
  const metricColumns = headers.filter(h => {
    const lower = h.toLowerCase();
    return lower.includes('session') ||
           lower.includes('user') ||
           lower.includes('revenue') ||
           lower.includes('conversion') ||
           lower.includes('click') ||
           lower.includes('impression') ||
           lower.includes('view') ||
           lower.includes('cost') ||
           lower.includes('ctr') ||
           lower.includes('rate');
  });

  metricColumns.forEach(col => {
    const colIndex = headers.indexOf(col);
    if (colIndex !== -1) {
      const values = rows.map(row => {
        const value = row[colIndex];
        if (!value) return 0;
        // Remove common formatting characters
        const cleaned = value.replace(/[$,%]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }).filter(v => !isNaN(v) && v !== 0);
      
      if (values.length > 0) {
        keyMetrics[col] = values.reduce((sum, val) => sum + val, 0);
      }
    }
  });

  // Merge AI metrics with calculated metrics
  const aiMetrics = parsed.keyMetrics || {};
  const finalMetrics = { ...keyMetrics };
  
  // Add AI metrics if they're valid numbers
  Object.entries(aiMetrics).forEach(([key, value]) => {
    if (typeof value === 'number' && !isNaN(value)) {
      finalMetrics[key] = value;
    }
  });

  return {
    insights: Array.isArray(parsed.insights) ? parsed.insights.map(validateInsight).filter(Boolean) : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(validateRecommendation).filter(Boolean) : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed successfully.',
    keyMetrics: finalMetrics
  };
}

function validateInsight(insight: any): Insight | null {
  if (!insight || typeof insight !== 'object') return null;
  
  const validImpacts = ['high', 'medium', 'low'];
  
  return {
    category: typeof insight.category === 'string' ? insight.category : 'General',
    title: typeof insight.title === 'string' ? insight.title : 'Insight',
    description: typeof insight.description === 'string' ? insight.description : 'No description available',
    impact: validImpacts.includes(insight.impact) ? insight.impact : 'medium',
    metrics: insight.metrics && typeof insight.metrics === 'object' ? insight.metrics : undefined
  };
}

function validateRecommendation(recommendation: any): Recommendation | null {
  if (!recommendation || typeof recommendation !== 'object') return null;
  
  const validPriorities = ['high', 'medium', 'low'];
  const validEfforts = ['low', 'medium', 'high'];
  
  return {
    title: typeof recommendation.title === 'string' ? recommendation.title : 'Recommendation',
    description: typeof recommendation.description === 'string' ? recommendation.description : 'No description available',
    priority: validPriorities.includes(recommendation.priority) ? recommendation.priority : 'medium',
    effort: validEfforts.includes(recommendation.effort) ? recommendation.effort : 'medium',
    expectedImpact: typeof recommendation.expectedImpact === 'string' ? recommendation.expectedImpact : 'Positive impact expected'
  };
}

function createFallbackAnalysis(headers: string[], rows: string[][], reportType: string): Omit<AnalyzeResponse, 'charts' | 'rawData' | 'dataSummary'> {
  const insights: Insight[] = [
    {
      category: "Data Overview",
      title: "Data Successfully Processed",
      description: `Your ${reportType} report contains ${rows.length} rows of data with ${headers.length} columns. The data includes metrics such as: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? ', and more' : ''}.`,
      impact: "medium" as const,
      metrics: { "total_rows": rows.length, "total_columns": headers.length }
    }
  ];

  const recommendations: Recommendation[] = [
    {
      title: "Review Data Quality",
      description: "Ensure all important metrics are being tracked consistently across your reporting periods. Look for any missing data points or anomalies.",
      priority: "medium" as const,
      effort: "low" as const,
      expectedImpact: "Improved data reliability and more accurate insights"
    },
    {
      title: "Set Up Regular Analysis",
      description: "Consider setting up automated reporting to track these metrics on a regular basis for better trend analysis.",
      priority: "low" as const,
      effort: "medium" as const,
      expectedImpact: "Better understanding of performance trends over time"
    }
  ];

  // Calculate basic metrics
  const keyMetrics: Record<string, number> = {
    "total_rows": rows.length,
    "total_columns": headers.length
  };

  // Try to find and sum numeric columns
  headers.forEach((header, index) => {
    const values = rows.map(row => {
      const value = row[index];
      if (!value) return 0;
      const cleaned = value.replace(/[$,%]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }).filter(v => v !== 0);

    if (values.length > 0 && values.length > rows.length * 0.5) {
      // If more than 50% of values are numeric, include the sum
      keyMetrics[header] = values.reduce((sum, val) => sum + val, 0);
    }
  });

  return {
    insights,
    recommendations,
    summary: `Analysis completed for your ${reportType} report. The dataset contains ${rows.length} rows and ${headers.length} columns of data. While AI analysis was not available, the data has been successfully processed and basic metrics have been calculated.`,
    keyMetrics
  };
}
