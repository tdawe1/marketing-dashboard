import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const googleClientId = secret("GoogleClientId");
const googleClientSecret = secret("GoogleClientSecret");
const googleDeveloperToken = secret("GoogleAdsDeveloperToken");

export interface AdsAuthRequest {
  redirectUri: string;
}

export interface AdsAuthResponse {
  authUrl: string;
  state: string;
}

export interface AdsTokenRequest {
  code: string;
  state: string;
  redirectUri: string;
}

export interface AdsTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AdsAccountsResponse {
  accounts: AdsAccount[];
}

export interface AdsAccount {
  id: string;
  name: string;
  customerId: string;
}

export interface AdsDataRequest {
  customerId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
}

export interface AdsDataResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

// Initiates Google Ads OAuth flow.
export const getAdsAuthUrl = api<AdsAuthRequest, AdsAuthResponse>(
  { expose: true, method: "POST", path: "/google-ads/auth" },
  async (req) => {
    const state = generateRandomState();
    const scope = "https://www.googleapis.com/auth/adwords";
    
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
export const exchangeAdsToken = api<AdsTokenRequest, AdsTokenResponse>(
  { expose: true, method: "POST", path: "/google-ads/token" },
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

// Fetches available Google Ads accounts.
export const getAdsAccounts = api<{ accessToken: string }, AdsAccountsResponse>(
  { expose: true, method: "POST", path: "/google-ads/accounts" },
  async (req) => {
    try {
      const query = `
        SELECT 
          customer.id,
          customer.descriptive_name
        FROM customer
        WHERE customer.status = 'ENABLED'
      `;

      const response = await fetch('https://googleads.googleapis.com/v14/customers:searchStream', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${req.accessToken}`,
          'developer-token': googleDeveloperToken(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Google Ads access token has expired",
            suggestion: "Please re-authorize your Google Ads account"
          });
        }
        throw APIError.internal("Failed to fetch accounts");
      }

      const data = await response.json();
      const accounts: AdsAccount[] = [];

      if (data.results) {
        for (const result of data.results) {
          if (result.customer) {
            accounts.push({
              id: result.customer.id,
              name: result.customer.descriptiveName || `Account ${result.customer.id}`,
              customerId: result.customer.id
            });
          }
        }
      }

      return { accounts };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to fetch Google Ads accounts", {
        code: "ADS_API_ERROR",
        message: "Unable to retrieve account information",
        suggestion: "Please check your access token and developer token"
      });
    }
  }
);

// Fetches Google Ads data for analysis.
export const getAdsData = api<AdsDataRequest, AdsDataResponse>(
  { expose: true, method: "POST", path: "/google-ads/data" },
  async (req) => {
    try {
      const selectFields = [...req.dimensions, ...req.metrics].join(', ');
      const query = `
        SELECT ${selectFields}
        FROM campaign
        WHERE segments.date BETWEEN '${req.startDate}' AND '${req.endDate}'
        ORDER BY segments.date DESC
        LIMIT 10000
      `;

      const response = await fetch(
        `https://googleads.googleapis.com/v14/customers/${req.customerId}:searchStream`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${req.accessToken}`,
            'developer-token': googleDeveloperToken(),
            'login-customer-id': req.customerId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query
          })
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Google Ads access token has expired",
            suggestion: "Please re-authorize your Google Ads account"
          });
        }
        if (response.status === 403) {
          throw APIError.permissionDenied("Insufficient permissions", {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to access this Google Ads account",
            suggestion: "Please ensure you have read access to the selected account"
          });
        }
        throw APIError.internal("Failed to fetch data from Google Ads");
      }

      const data = await response.json();
      
      // Build headers from requested fields
      const headers = [...req.dimensions, ...req.metrics];
      
      // Build rows from results
      const rows: string[][] = [];
      if (data.results) {
        for (const result of data.results) {
          const rowData: string[] = [];
          
          // Extract dimension values
          for (const dimension of req.dimensions) {
            const value = extractFieldValue(result, dimension);
            rowData.push(value);
          }
          
          // Extract metric values
          for (const metric of req.metrics) {
            const value = extractFieldValue(result, metric);
            rowData.push(value);
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
      throw APIError.internal("Failed to fetch Google Ads data", {
        code: "ADS_DATA_ERROR",
        message: "Unable to retrieve ads data",
        suggestion: "Please check your parameters and try again"
      });
    }
  }
);

function extractFieldValue(result: any, fieldPath: string): string {
  const parts = fieldPath.split('.');
  let value = result;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return '';
    }
  }
  
  return value ? value.toString() : '';
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
