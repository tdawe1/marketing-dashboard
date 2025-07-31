import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const googleClientId = secret("GoogleClientId");
const googleClientSecret = secret("GoogleClientSecret");

export interface GAAuthRequest {
  redirectUri: string;
}

export interface GAAuthResponse {
  authUrl: string;
  state: string;
}

export interface GATokenRequest {
  code: string;
  state: string;
  redirectUri: string;
}

export interface GATokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface GAAccountsResponse {
  accounts: GAAccount[];
}

export interface GAAccount {
  id: string;
  name: string;
  properties: GAProperty[];
}

export interface GAProperty {
  id: string;
  name: string;
  displayName: string;
}

export interface GADataRequest {
  propertyId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
}

export interface GADataResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

// Initiates Google Analytics OAuth flow.
export const getGAAuthUrl = api<GAAuthRequest, GAAuthResponse>(
  { expose: true, method: "POST", path: "/google-analytics/auth" },
  async (req) => {
    const state = generateRandomState();
    const scope = "https://www.googleapis.com/auth/analytics.readonly";
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${googleClientId()}&` +
      `redirect_uri=${encodeURIComponent(req.redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent&` +
      `state=${state}`;

    return {
      authUrl,
      state
    };
  }
);

// Exchanges authorization code for access tokens.
export const exchangeGAToken = api<GATokenRequest, GATokenResponse>(
  { expose: true, method: "POST", path: "/google-analytics/token" },
  async (req) => {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: googleClientId(),
          client_secret: googleClientSecret(),
          code: req.code,
          grant_type: 'authorization_code',
          redirect_uri: req.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw APIError.invalidArgument("Token exchange failed", {
          code: "TOKEN_EXCHANGE_ERROR",
          message: "Failed to exchange authorization code for tokens",
          suggestion: "Please try the authorization process again"
        });
      }

      const data = await response.json();
      
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Token exchange failed", {
        code: "OAUTH_ERROR",
        message: "Unable to complete OAuth token exchange",
        suggestion: "Please try again or check your OAuth configuration"
      });
    }
  }
);

// Fetches available Google Analytics accounts and properties.
export const getGAAccounts = api<{ accessToken: string }, GAAccountsResponse>(
  { expose: true, method: "POST", path: "/google-analytics/accounts" },
  async (req) => {
    try {
      const response = await fetch('https://analyticsadmin.googleapis.com/v1beta/accounts', {
        headers: {
          'Authorization': `Bearer ${req.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Google Analytics access token has expired",
            suggestion: "Please re-authorize your Google Analytics account"
          });
        }
        throw APIError.internal("Failed to fetch accounts");
      }

      const data = await response.json();
      const accounts: GAAccount[] = [];

      if (data.accounts) {
        for (const account of data.accounts) {
          const propertiesResponse = await fetch(
            `https://analyticsadmin.googleapis.com/v1beta/${account.name}/properties`,
            {
              headers: {
                'Authorization': `Bearer ${req.accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          let properties: GAProperty[] = [];
          if (propertiesResponse.ok) {
            const propertiesData = await propertiesResponse.json();
            properties = (propertiesData.properties || []).map((prop: any) => ({
              id: prop.name.split('/').pop(),
              name: prop.name,
              displayName: prop.displayName
            }));
          }

          accounts.push({
            id: account.name.split('/').pop(),
            name: account.displayName,
            properties
          });
        }
      }

      return { accounts };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to fetch Google Analytics accounts", {
        code: "GA_API_ERROR",
        message: "Unable to retrieve account information",
        suggestion: "Please check your access token and try again"
      });
    }
  }
);

// Fetches Google Analytics data for analysis.
export const getGAData = api<GADataRequest, GADataResponse>(
  { expose: true, method: "POST", path: "/google-analytics/data" },
  async (req) => {
    try {
      const requestBody = {
        dateRanges: [{
          startDate: req.startDate,
          endDate: req.endDate
        }],
        metrics: req.metrics.map(metric => ({ name: metric })),
        dimensions: req.dimensions.map(dimension => ({ name: dimension })),
        limit: 10000
      };

      const response = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${req.propertyId}:runReport`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Google Analytics access token has expired",
            suggestion: "Please re-authorize your Google Analytics account"
          });
        }
        if (response.status === 403) {
          throw APIError.permissionDenied("Insufficient permissions", {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to access this Google Analytics property",
            suggestion: "Please ensure you have read access to the selected property"
          });
        }
        throw APIError.internal("Failed to fetch data from Google Analytics");
      }

      const data = await response.json();
      
      // Build headers
      const headers: string[] = [];
      if (data.dimensionHeaders) {
        headers.push(...data.dimensionHeaders.map((h: any) => h.name));
      }
      if (data.metricHeaders) {
        headers.push(...data.metricHeaders.map((h: any) => h.name));
      }

      // Build rows
      const rows: string[][] = [];
      if (data.rows) {
        for (const row of data.rows) {
          const rowData: string[] = [];
          
          if (row.dimensionValues) {
            rowData.push(...row.dimensionValues.map((v: any) => v.value || ''));
          }
          
          if (row.metricValues) {
            rowData.push(...row.metricValues.map((v: any) => v.value || '0'));
          }
          
          rows.push(rowData);
        }
      }

      return {
        headers,
        rows,
        totalRows: rows.length
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to fetch Google Analytics data", {
        code: "GA_DATA_ERROR",
        message: "Unable to retrieve analytics data",
        suggestion: "Please check your parameters and try again"
      });
    }
  }
);

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
