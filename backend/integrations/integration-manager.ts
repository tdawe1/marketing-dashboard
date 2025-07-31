import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const reportsBucket = new Bucket("reports");

export interface IntegrationDataRequest {
  platform: "google-analytics" | "google-ads" | "facebook-ads";
  accountId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  metrics?: string[];
  dimensions?: string[];
}

export interface IntegrationDataResponse {
  fileId: string;
  fileName: string;
  totalRows: number;
  headers: string[];
  uploadedAt: Date;
}

export interface PlatformConfig {
  name: string;
  defaultMetrics: string[];
  defaultDimensions: string[];
  maxDateRange: number; // days
}

export interface PlatformConfigsResponse {
  platforms: Record<string, PlatformConfig>;
}

// Fetches data from integrated platforms and stores it for analysis.
export const fetchData = api<IntegrationDataRequest, IntegrationDataResponse>(
  { expose: true, method: "POST", path: "/integrations/fetch-data" },
  async (req) => {
    try {
      // Validate date range
      const startDate = new Date(req.startDate);
      const endDate = new Date(req.endDate);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 365) {
        throw APIError.invalidArgument("Date range too large", {
          code: "DATE_RANGE_TOO_LARGE",
          message: "Date range cannot exceed 365 days",
          suggestion: "Please select a smaller date range"
        });
      }

      if (startDate > endDate) {
        throw APIError.invalidArgument("Invalid date range", {
          code: "INVALID_DATE_RANGE",
          message: "Start date must be before end date",
          suggestion: "Please check your date selection"
        });
      }

      // Get platform configuration
      const platformConfig = getPlatformConfig(req.platform);
      
      // Use default metrics/dimensions if not provided
      const metrics = req.metrics && req.metrics.length > 0 
        ? req.metrics 
        : platformConfig.defaultMetrics;
      const dimensions = req.dimensions && req.dimensions.length > 0 
        ? req.dimensions 
        : platformConfig.defaultDimensions;

      // Fetch data from the appropriate platform
      let data: { headers: string[]; rows: string[][]; totalRows: number };
      
      switch (req.platform) {
        case "google-analytics":
          const { integrations } = await import("~encore/clients");
          data = await integrations.getGAData({
            propertyId: req.accountId,
            accessToken: req.accessToken,
            startDate: req.startDate,
            endDate: req.endDate,
            metrics,
            dimensions
          });
          break;
          
        case "google-ads":
          const { integrations: adsIntegrations } = await import("~encore/clients");
          data = await adsIntegrations.getAdsData({
            customerId: req.accountId,
            accessToken: req.accessToken,
            startDate: req.startDate,
            endDate: req.endDate,
            metrics,
            dimensions
          });
          break;
          
        case "facebook-ads":
          const { integrations: fbIntegrations } = await import("~encore/clients");
          data = await fbIntegrations.getFacebookData({
            accountId: req.accountId,
            accessToken: req.accessToken,
            startDate: req.startDate,
            endDate: req.endDate,
            metrics,
            dimensions
          });
          break;
          
        default:
          throw APIError.invalidArgument("Unsupported platform", {
            code: "UNSUPPORTED_PLATFORM",
            message: `Platform '${req.platform}' is not supported`,
            suggestion: "Please use one of: google-analytics, google-ads, facebook-ads"
          });
      }

      if (!data.rows || data.rows.length === 0) {
        throw APIError.invalidArgument("No data found", {
          code: "NO_DATA_FOUND",
          message: "No data was found for the specified date range and parameters",
          suggestion: "Try adjusting your date range or check if the account has data"
        });
      }

      // Convert data to CSV format
      const csvContent = convertToCSV(data.headers, data.rows);
      const csvBuffer = Buffer.from(csvContent, 'utf-8');

      // Generate unique file ID and name
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fileName = `${req.platform}-${req.startDate}-to-${req.endDate}.csv`;
      const storagePath = `${fileId}-${fileName}`;

      // Upload to storage
      try {
        await reportsBucket.upload(storagePath, csvBuffer, {
          contentType: 'text/csv'
        });
      } catch (error) {
        throw APIError.internal("Storage upload failed", {
          code: "STORAGE_ERROR",
          message: "Failed to save fetched data to storage",
          suggestion: "Please try again. If the problem persists, contact support"
        });
      }

      return {
        fileId,
        fileName,
        totalRows: data.totalRows,
        headers: data.headers,
        uploadedAt: new Date()
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Data fetch failed", {
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch data from platform",
        suggestion: "Please check your access token and account permissions"
      });
    }
  }
);

// Returns configuration for supported platforms.
export const getPlatformConfigs = api<void, PlatformConfigsResponse>(
  { expose: true, method: "GET", path: "/integrations/platforms" },
  async () => {
    const platforms: Record<string, PlatformConfig> = {
      "google-analytics": {
        name: "Google Analytics 4",
        defaultMetrics: [
          "sessions",
          "totalUsers",
          "screenPageViews",
          "bounceRate",
          "sessionDuration"
        ],
        defaultDimensions: [
          "date",
          "country",
          "deviceCategory",
          "sessionDefaultChannelGroup"
        ],
        maxDateRange: 365
      },
      "google-ads": {
        name: "Google Ads",
        defaultMetrics: [
          "metrics.impressions",
          "metrics.clicks",
          "metrics.cost_micros",
          "metrics.conversions",
          "metrics.ctr"
        ],
        defaultDimensions: [
          "segments.date",
          "campaign.name",
          "campaign.status"
        ],
        maxDateRange: 365
      },
      "facebook-ads": {
        name: "Facebook Ads",
        defaultMetrics: [
          "impressions",
          "clicks",
          "spend",
          "conversions",
          "ctr"
        ],
        defaultDimensions: [
          "date_start",
          "campaign_name",
          "objective"
        ],
        maxDateRange: 365
      }
    };

    return { platforms };
  }
);

function getPlatformConfig(platform: string): PlatformConfig {
  const configs: Record<string, PlatformConfig> = {
    "google-analytics": {
      name: "Google Analytics 4",
      defaultMetrics: [
        "sessions",
        "totalUsers",
        "screenPageViews",
        "bounceRate",
        "sessionDuration"
      ],
      defaultDimensions: [
        "date",
        "country",
        "deviceCategory",
        "sessionDefaultChannelGroup"
      ],
      maxDateRange: 365
    },
    "google-ads": {
      name: "Google Ads",
      defaultMetrics: [
        "metrics.impressions",
        "metrics.clicks",
        "metrics.cost_micros",
        "metrics.conversions",
        "metrics.ctr"
      ],
      defaultDimensions: [
        "segments.date",
        "campaign.name",
        "campaign.status"
      ],
      maxDateRange: 365
    },
    "facebook-ads": {
      name: "Facebook Ads",
      defaultMetrics: [
        "impressions",
        "clicks",
        "spend",
        "conversions",
        "ctr"
      ],
      defaultDimensions: [
        "date_start",
        "campaign_name",
        "objective"
      ],
      maxDateRange: 365
    }
  };

  return configs[platform];
}

function convertToCSV(headers: string[], rows: string[][]): string {
  const csvRows: string[] = [];
  
  // Add headers
  csvRows.push(headers.map(header => `"${header}"`).join(','));
  
  // Add data rows
  for (const row of rows) {
    const csvRow = row.map(cell => {
      // Escape quotes and wrap in quotes if necessary
      const escaped = cell.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
    csvRows.push(csvRow);
  }
  
  return csvRows.join('\n');
}
