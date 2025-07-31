import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, TrendingUp, BarChart3, Plus, Settings, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { UnifiedDashboardResponse, MetricSource } from '~backend/dashboard/unified-metrics';
import MetricComparisonCard from './MetricComparisonCard';
import TimeSeriesChart from './TimeSeriesChart';
import SourceManagementDialog from './SourceManagementDialog';
import DemoModeToggle from './DemoModeToggle';
import { useDemoMode } from '../hooks/useDemoMode';
import { demoUnifiedData } from '../utils/demoData';

interface UnifiedDashboardProps {
  onNavigateToAnalysis?: (fileId: string) => void;
}

export default function UnifiedDashboard({ onNavigateToAnalysis }: UnifiedDashboardProps) {
  const { toast } = useToast();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [showSourceDialog, setShowSourceDialog] = useState(false);

  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['unified-dashboard', selectedSources, startDate, endDate, groupBy, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return demoUnifiedData;
      }

      return backend.dashboard.unifiedMetrics.getUnifiedDashboard({
        sourceIds: selectedSources.length > 0 ? selectedSources : undefined,
        startDate,
        endDate,
        groupBy
      });
    },
    refetchInterval: isDemoMode ? undefined : 5 * 60 * 1000, // Refetch every 5 minutes (only in non-demo mode)
  });

  const handleSourceToggle = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleRemoveSource = async (sourceId: string) => {
    if (isDemoMode) {
      toast({
        title: "Demo mode",
        description: "Source removal is simulated in demo mode.",
      });
      return;
    }

    try {
      await backend.dashboard.unifiedMetrics.removeMetricSource({ sourceId });
      toast({
        title: "Source removed",
        description: "The data source has been removed from your dashboard.",
      });
      refetch();
    } catch (error) {
      console.error('Remove source error:', error);
      toast({
        title: "Failed to remove source",
        description: error instanceof Error ? error.message : 'Could not remove data source',
        variant: "destructive",
      });
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'google-analytics':
        return '📊';
      case 'google-ads':
        return '🎯';
      case 'facebook-ads':
        return '📱';
      default:
        return '📄';
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'google-analytics':
        return 'bg-orange-100 text-orange-800';
      case 'google-ads':
        return 'bg-blue-100 text-blue-800';
      case 'facebook-ads':
        return 'bg-blue-100 text-blue-900';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error && !isDemoMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load dashboard data. Please try again or enable demo mode to see how it works.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Unified Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Compare performance across all your data sources and platforms
            {isDemoMode && (
              <span className="text-purple-600 ml-2">• Demo Mode Active</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <DemoModeToggle isDemoMode={isDemoMode} onToggle={toggleDemoMode} />
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowSourceDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Source
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div>
              <Label htmlFor="groupBy">Group By</Label>
              <Select value={groupBy} onValueChange={(value: 'day' | 'week' | 'month') => setGroupBy(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} className="w-full">
                <BarChart3 className="h-4 w-4 mr-2" />
                Update Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      {dashboardData && dashboardData.sources.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Data Sources</CardTitle>
            <p className="text-sm text-gray-600">
              Select sources to include in your analysis
              {isDemoMode && (
                <span className="text-purple-600 ml-2">• Demo sources shown</span>
              )}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.sources.map(source => (
                <div
                  key={source.id}
                  className={`
                    border rounded-lg p-4 cursor-pointer transition-all
                    ${selectedSources.includes(source.id) || selectedSources.length === 0
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => handleSourceToggle(source.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getPlatformIcon(source.platform || 'manual')}</span>
                      <h4 className="font-medium">{source.name}</h4>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSource(source.id);
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex gap-2 mb-2">
                    <Badge className={getPlatformColor(source.platform || 'manual')}>
                      {source.platform || 'Manual'}
                    </Badge>
                    <Badge className={getStatusColor(source.status)}>
                      {source.status}
                    </Badge>
                    {isDemoMode && (
                      <Badge variant="outline" className="text-purple-600">
                        Demo
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>Type: {source.type}</div>
                    {source.rowCount && <div>Rows: {source.rowCount.toLocaleString()}</div>}
                    {source.dateRange && (
                      <div>Range: {source.dateRange.start} to {source.dateRange.end}</div>
                    )}
                    <div>Added: {source.uploadedAt.toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.summary.totalSources}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Metrics Tracked</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData.summary.totalMetricsTracked}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Date Range</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {dashboardData.summary.dateRange.start} to {dashboardData.summary.dateRange.end}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Top Performer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {dashboardData.summary.topPerformingSource.sourceName || 'No data'}
              </div>
              {dashboardData.summary.topPerformingSource.platform && (
                <div className="text-xs text-gray-600">
                  {dashboardData.summary.topPerformingSource.platform}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Insights */}
      {dashboardData && dashboardData.insights.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cross-Platform Insights
              {isDemoMode && (
                <Badge variant="outline" className="text-purple-600">Demo</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboardData.insights.map((insight, index) => (
                <div
                  key={index}
                  className={`
                    p-4 rounded-lg border-l-4
                    ${insight.impact === 'high' ? 'border-red-500 bg-red-50' :
                      insight.impact === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{insight.title}</h4>
                    <div className="flex gap-2">
                      <Badge variant="outline">{insight.type}</Badge>
                      <Badge 
                        className={
                          insight.impact === 'high' ? 'bg-red-100 text-red-800' :
                          insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }
                      >
                        {insight.impact} impact
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metric Comparisons */}
      {dashboardData && dashboardData.keyMetrics.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Metric Comparisons
            {isDemoMode && (
              <Badge variant="outline" className="text-purple-600 ml-2">Demo Data</Badge>
            )}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboardData.keyMetrics.slice(0, 6).map((metric, index) => (
              <MetricComparisonCard key={index} comparison={metric} />
            ))}
          </div>
        </div>
      )}

      {/* Time Series Charts */}
      {dashboardData && Object.keys(dashboardData.timeSeriesData).length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Performance Trends
            {isDemoMode && (
              <Badge variant="outline" className="text-purple-600 ml-2">Demo Data</Badge>
            )}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(dashboardData.timeSeriesData).slice(0, 4).map(([metricName, data]) => (
              <TimeSeriesChart
                key={metricName}
                title={metricName}
                data={data}
                sources={dashboardData.sources}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {dashboardData && dashboardData.sources.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Sources</h3>
            <p className="text-gray-600 mb-4">
              {isDemoMode 
                ? 'Add demo data sources to see how the unified dashboard works.'
                : 'Add your first data source to start comparing performance across platforms.'
              }
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setShowSourceDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Data Source
              </Button>
              {!isDemoMode && (
                <Button variant="outline" onClick={toggleDemoMode}>
                  Try Demo Mode
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <SourceManagementDialog
        isOpen={showSourceDialog}
        onClose={() => setShowSourceDialog(false)}
        onSourceAdded={() => {
          refetch();
          setShowSourceDialog(false);
        }}
        onNavigateToAnalysis={onNavigateToAnalysis}
      />
    </div>
  );
}
