import React, { useState } from 'react';
import { Calendar, Settings, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import ScheduledJobDialog from './ScheduledJobDialog';
import { useDemoMode } from '../hooks/useDemoMode';

interface IntegrationCardProps {
  platform: {
    id: string;
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
  };
  onDataFetched: (fileId: string) => void;
}

interface Account {
  id: string;
  name: string;
  customerId?: string;
  accountId?: string;
}

export default function IntegrationCard({ platform, onDataFetched }: IntegrationCardProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const [isConnected, setIsConnected] = useState(isDemoMode);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [accessToken, setAccessToken] = useState(isDemoMode ? 'demo-token' : '');
  const [accounts, setAccounts] = useState<Account[]>(isDemoMode ? [
    { id: 'demo-account-1', name: `Demo ${platform.name} Account` },
    { id: 'demo-account-2', name: `Sample ${platform.name} Property` }
  ] : []);
  const [selectedAccount, setSelectedAccount] = useState(isDemoMode ? 'demo-account-1' : '');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const handleConnect = async () => {
    if (isDemoMode) {
      setIsConnecting(true);
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      setIsConnected(true);
      setAccessToken('demo-token');
      setAccounts([
        { id: 'demo-account-1', name: `Demo ${platform.name} Account` },
        { id: 'demo-account-2', name: `Sample ${platform.name} Property` }
      ]);
      setSelectedAccount('demo-account-1');
      setIsConnecting(false);
      toast({
        title: "Demo connection successful",
        description: `Connected to ${platform.name} with sample data.`,
      });
      return;
    }

    setIsConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/oauth/callback`;
      
      let authResponse;
      switch (platform.id) {
        case 'google-analytics':
          authResponse = await backend.integrations.getGAAuthUrl({ redirectUri });
          break;
        case 'google-ads':
          authResponse = await backend.integrations.getAdsAuthUrl({ redirectUri });
          break;
        case 'facebook-ads':
          authResponse = await backend.integrations.getFacebookAuthUrl({ redirectUri });
          break;
        default:
          throw new Error('Unsupported platform');
      }

      // Store state for OAuth callback
      localStorage.setItem(`oauth_state_${platform.id}`, authResponse.state);
      localStorage.setItem(`oauth_platform`, platform.id);
      
      // Open OAuth window
      window.location.href = authResponse.authUrl;
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection failed",
        description: error instanceof Error ? error.message : 'Failed to connect to platform',
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFetchAccounts = async () => {
    if (!accessToken) return;
    
    if (isDemoMode) {
      // Already set in demo mode
      return;
    }
    
    try {
      let accountsResponse;
      switch (platform.id) {
        case 'google-analytics':
          accountsResponse = await backend.integrations.getGAAccounts({ accessToken });
          setAccounts(accountsResponse.accounts.flatMap(acc => 
            acc.properties.map(prop => ({
              id: prop.id,
              name: `${acc.name} - ${prop.displayName}`,
            }))
          ));
          break;
        case 'google-ads':
          accountsResponse = await backend.integrations.getAdsAccounts({ accessToken });
          setAccounts(accountsResponse.accounts.map(acc => ({
            id: acc.customerId,
            name: acc.name,
            customerId: acc.customerId
          })));
          break;
        case 'facebook-ads':
          accountsResponse = await backend.integrations.getFacebookAccounts({ accessToken });
          setAccounts(accountsResponse.accounts.map(acc => ({
            id: acc.accountId,
            name: acc.name,
            accountId: acc.accountId
          })));
          break;
      }
    } catch (error) {
      console.error('Fetch accounts error:', error);
      toast({
        title: "Failed to fetch accounts",
        description: error instanceof Error ? error.message : 'Could not retrieve accounts',
        variant: "destructive",
      });
    }
  };

  const handleFetchData = async () => {
    if (!selectedAccount || !accessToken) return;
    
    setIsFetching(true);
    try {
      if (isDemoMode) {
        // Simulate data fetching delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const demoFileId = `demo-${platform.id}-${Date.now()}`;
        
        toast({
          title: "Demo data fetched successfully",
          description: `Retrieved sample ${platform.name} data for demonstration.`,
        });

        onDataFetched(demoFileId);
        return;
      }

      const response = await backend.integrations.integrationManager.fetchData({
        platform: platform.id as "google-analytics" | "google-ads" | "facebook-ads",
        accountId: selectedAccount,
        accessToken,
        startDate,
        endDate
      });

      toast({
        title: "Data fetched successfully",
        description: `Retrieved ${response.totalRows} rows of data`,
      });

      onDataFetched(response.fileId);
    } catch (error) {
      console.error('Fetch data error:', error);
      toast({
        title: "Failed to fetch data",
        description: error instanceof Error ? error.message : 'Could not retrieve data',
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleScheduleJob = () => {
    if (!selectedAccount || !accessToken) {
      toast({
        title: "Setup required",
        description: "Please connect and select an account first.",
        variant: "destructive",
      });
      return;
    }
    setShowScheduleDialog(true);
  };

  // Check for OAuth callback on component mount (only in non-demo mode)
  React.useEffect(() => {
    if (isDemoMode) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem(`oauth_state_${platform.id}`);
    const storedPlatform = localStorage.getItem('oauth_platform');

    if (code && state && storedState === state && storedPlatform === platform.id) {
      // Handle OAuth callback
      const exchangeToken = async () => {
        try {
          const redirectUri = `${window.location.origin}/oauth/callback`;
          let tokenResponse;
          
          switch (platform.id) {
            case 'google-analytics':
              tokenResponse = await backend.integrations.exchangeGAToken({
                code,
                state,
                redirectUri
              });
              break;
            case 'google-ads':
              tokenResponse = await backend.integrations.exchangeAdsToken({
                code,
                state,
                redirectUri
              });
              break;
            case 'facebook-ads':
              tokenResponse = await backend.integrations.exchangeFacebookToken({
                code,
                state,
                redirectUri
              });
              break;
          }

          if (tokenResponse) {
            setAccessToken(tokenResponse.accessToken);
            setIsConnected(true);
            
            // Clean up OAuth state
            localStorage.removeItem(`oauth_state_${platform.id}`);
            localStorage.removeItem('oauth_platform');
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            toast({
              title: "Connected successfully",
              description: `Connected to ${platform.name}`,
            });
          }
        } catch (error) {
          console.error('Token exchange error:', error);
          toast({
            title: "Connection failed",
            description: error instanceof Error ? error.message : 'Failed to complete connection',
            variant: "destructive",
          });
        }
      };

      exchangeToken();
    }
  }, [platform.id, platform.name, toast, isDemoMode]);

  // Fetch accounts when connected (only in non-demo mode)
  React.useEffect(() => {
    if (!isDemoMode && isConnected && accessToken && accounts.length === 0) {
      handleFetchAccounts();
    }
  }, [isConnected, accessToken, isDemoMode]);

  return (
    <>
      <Card className="relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${platform.color}`} />
        
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {platform.icon}
              <div>
                <h3 className="font-semibold">{platform.name}</h3>
                <p className="text-sm text-gray-600 font-normal">{platform.description}</p>
              </div>
            </div>
            {isConnected && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                {isDemoMode ? 'Demo' : 'Connected'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {!isConnected ? (
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDemoMode ? 'Loading demo...' : 'Connecting...'}
                </>
              ) : (
                <>
                  {isDemoMode ? `Try ${platform.name} Demo` : `Connect to ${platform.name}`}
                </>
              )}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Account Selection */}
              <div>
                <Label htmlFor="account">Select Account</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Advanced Options */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Advanced Options
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <p className="text-sm text-gray-600">
                    {isDemoMode 
                      ? 'Demo mode uses predefined metrics and dimensions optimized for showcase.'
                      : 'Custom metrics and dimensions will be available in a future update. Currently using default settings optimized for analysis.'
                    }
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={handleFetchData}
                  disabled={!selectedAccount || isFetching}
                  variant="outline"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {isDemoMode ? 'Loading...' : 'Fetching...'}
                    </>
                  ) : (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      {isDemoMode ? 'Load Demo' : 'Fetch Once'}
                    </>
                  )}
                </Button>

                <Button 
                  onClick={handleScheduleJob}
                  disabled={!selectedAccount}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduledJobDialog
        isOpen={showScheduleDialog}
        onClose={() => setShowScheduleDialog(false)}
        onSave={() => {
          setShowScheduleDialog(false);
          toast({
            title: isDemoMode ? "Demo job scheduled" : "Job scheduled",
            description: `Automated data fetching has been set up for ${platform.name}.`,
          });
        }}
        platform={platform.id}
        accountId={selectedAccount}
        accessToken={accessToken}
      />
    </>
  );
}
