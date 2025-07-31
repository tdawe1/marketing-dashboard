import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";

const facebookAppId = secret("FacebookAppId");
const facebookAppSecret = secret("FacebookAppSecret");

export interface FacebookAuthRequest {
  redirectUri: string;
}

export interface FacebookAuthResponse {
  authUrl: string;
  state: string;
}

export interface FacebookTokenRequest {
  code: string;
  state: string;
  redirectUri: string;
}

export interface FacebookTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface FacebookAccountsResponse {
  accounts: FacebookAccount[];
}

export interface FacebookAccount {
  id: string;
  name: string;
  accountId: string;
}

export interface FacebookDataRequest {
  accountId: string;
  accessToken: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions: string[];
}

export interface FacebookDataResponse {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

// Initiates Facebook Ads OAuth flow.
export const getFacebookAuthUrl = api<FacebookAuthRequest, FacebookAuthResponse>(
  { expose: true, method: "POST", path: "/facebook-ads/auth" },
  async (req) => {
    const state = generateRandomState();
    const scope = "ads_read,read_insights";
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${facebookAppId()}&` +
      `redirect_uri=${encodeURIComponent(req.redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `state=${state}`;

    return {
      authUrl,
      state
    };
  }
);

// Exchanges authorization code for access tokens.
export const exchangeFacebookToken = api<FacebookTokenRequest, FacebookTokenResponse>(
  { expose: true, method: "POST", path: "/facebook-ads/token" },
  async (req) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${facebookAppId()}&` +
        `client_secret=${facebookAppSecret()}&` +
        `redirect_uri=${encodeURIComponent(req.redirectUri)}&` +
        `code=${req.code}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        throw APIError.invalidArgument("Token exchange failed", {
          code: "TOKEN_EXCHANGE_ERROR",
          message: "Failed to exchange authorization code for tokens",
          suggestion: "Please try the authorization process again"
        });
      }

      const data = await response.json();
      
      if (data.error) {
        throw APIError.invalidArgument("Facebook OAuth error", {
          code: "FACEBOOK_OAUTH_ERROR",
          message: data.error.message || "OAuth authorization failed",
          suggestion: "Please try the authorization process again"
        });
      }
      
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in || 3600
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

// Fetches available Facebook Ads accounts.
export const getFacebookAccounts = api<{ accessToken: string }, FacebookAccountsResponse>(
  { expose: true, method: "POST", path: "/facebook-ads/accounts" },
  async (req) => {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=${req.accessToken}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Facebook access token has expired",
            suggestion: "Please re-authorize your Facebook account"
          });
        }
        throw APIError.internal("Failed to fetch accounts");
      }

      const data = await response.json();
      
      if (data.error) {
        throw APIError.internal("Facebook API error", {
          code: "FACEBOOK_API_ERROR",
          message: data.error.message || "Failed to fetch accounts",
          suggestion: "Please check your permissions and try again"
        });
      }

      const accounts: FacebookAccount[] = [];
      if (data.data) {
        for (const account of data.data) {
          accounts.push({
            id: account.id,
            name: account.name,
            accountId: account.account_id
          });
        }
      }

      return { accounts };
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to fetch Facebook Ads accounts", {
        code: "FACEBOOK_API_ERROR",
        message: "Unable to retrieve account information",
        suggestion: "Please check your access token and try again"
      });
    }
  }
);

// Fetches Facebook Ads data for analysis.
export const getFacebookData = api<FacebookDataRequest, FacebookDataResponse>(
  { expose: true, method: "POST", path: "/facebook-ads/data" },
  async (req) => {
    try {
      const fields = [...req.dimensions, ...req.metrics].join(',');
      const timeRange = `{"since":"${req.startDate}","until":"${req.endDate}"}`;
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${req.accountId}/insights?` +
        `fields=${encodeURIComponent(fields)}&` +
        `time_range=${encodeURIComponent(timeRange)}&` +
        `level=campaign&` +
        `limit=1000&` +
        `access_token=${req.accessToken}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw APIError.unauthenticated("Invalid or expired access token", {
            code: "TOKEN_EXPIRED",
            message: "Your Facebook access token has expired",
            suggestion: "Please re-authorize your Facebook account"
          });
        }
        if (response.status === 403) {
          throw APIError.permissionDenied("Insufficient permissions", {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "You don't have permission to access this Facebook Ads account",
            suggestion: "Please ensure you have read access to the selected account"
          });
        }
        throw APIError.internal("Failed to fetch data from Facebook Ads");
      }

      const data = await response.json();
      
      if (data.error) {
        throw APIError.internal("Facebook API error", {
          code: "FACEBOOK_API_ERROR",
          message: data.error.message || "Failed to fetch data",
          suggestion: "Please check your parameters and try again"
        });
      }
      
      // Build headers
      const headers = [...req.dimensions, ...req.metrics];
      
      // Build rows
      const rows: string[][] = [];
      if (data.data) {
        for (const item of data.data) {
          const rowData: string[] = [];
          
          // Extract dimension and metric values
          for (const field of headers) {
            const value = item[field];
            rowData.push(value ? value.toString() : '');
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
      throw APIError.internal("Failed to fetch Facebook Ads data", {
        code: "FACEBOOK_DATA_ERROR",
        message: "Unable to retrieve ads data",
        suggestion: "Please check your parameters and try again"
      });
    }
  }
);

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
