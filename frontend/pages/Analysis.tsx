import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Share2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { AnalyzeResponse, FilterOptions } from '~backend/dashboard/analyze';
import InsightCard from '../components/InsightCard';
import RecommendationCard from '../components/RecommendationCard';
import MetricsGrid from '../components/MetricsGrid';
import ChartsGrid from '../components/ChartsGrid';
import ExportDialog from '../components/ExportDialog';
import DataFilters from '../components/DataFilters';
import DemoModeToggle from '../components/DemoModeToggle';
import { useDemoMode } from '../hooks/useDemoMode';
import { demoAnalysisData } from '../utils/demoData';

export default function Analysis() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [reportType, setReportType] = useState<'ga4' | 'ads' | 'general'>('general');
  const [analysisType, setAnalysisType] = useState<'insights' | 'recommendations' | 'summary'>('insights');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Check if this is a demo file ID
  const isDemoFile = fileId?.startsWith('demo-');

  const { data: analysis, isLoading, error, refetch } = useQuery({
    queryKey: ['analysis', fileId, reportType, analysisType, filters],
    queryFn: async () => {
      if (!fileId) throw new Error('File ID is required');
      
      // Return demo data for demo files or when in demo mode
      if (isDemoMode || isDemoFile) {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        return demoAnalysisData;
      }
      
      return backend.dashboard.analyze({
        fileId,
        reportType,
        analysisType,
        filters
      });
    },
    enabled: !!fileId,
    retry: (failureCount, error) => {
      // Don't retry on client errors (4xx)
      if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as any).status;
        if (status >= 400 && status < 500) {
          return false;
        }
      }
      return failureCount < 2;
    }
  });

  // Auto-enable demo mode for demo files
  useEffect(() => {
    if (isDemoFile && !isDemoMode) {
      toggleDemoMode();
    }
  }, [isDemoFile, isDemoMode, toggleDemoMode]);

  const handleAnalyze = () => {
    refetch();
    toast({
      title: "Analysis started",
      description: isDemoMode || isDemoFile 
        ? "Generating demo insights based on your selections."
        : "Generating new insights based on your selections.",
    });
  };

  const handleFiltersChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  const getErrorDetails = (error: any) => {
    if (error && typeof error === 'object' && 'details' in error) {
      const details = error.details;
      if (details && typeof details === 'object') {
        return {
          message: details.message || 'An error occurred during analysis',
          suggestion: details.suggestion || 'Please try again',
          code: details.code || 'UNKNOWN_ERROR'
        };
      }
    }
    
    return {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      suggestion: 'Please try again or contact support if the problem persists',
      code: 'UNKNOWN_ERROR'
    };
  };

  const renderError = () => {
    const errorDetails = getErrorDetails(error);
    
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{errorDetails.message}</p>
                <p className="text-sm opacity-90">{errorDetails.suggestion}</p>
                {errorDetails.code && (
                  <p className="text-xs opacity-75">Error Code: {errorDetails.code}</p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                Analysis Failed
              </CardTitle>
              <CardDescription>
                We encountered an issue while analyzing your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">What you can try:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Check that your file contains valid data with headers</li>
                  <li>Ensure your CSV file has at least 2 data rows</li>
                  <li>Verify that numeric columns contain valid numbers</li>
                  <li>Try uploading a smaller file if the current one is very large</li>
                  <li>Make sure your file is properly formatted (CSV, XLS, or XLSX)</li>
                  <li>Adjust your filters to include more data</li>
                  <li>Try enabling demo mode to see how the analysis works</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={() => navigate('/')} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Upload New File
                </Button>
                <Button onClick={() => refetch()} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  if (error && !isDemoMode && !isDemoFile) {
    return renderError();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analysis Results</h1>
            {(isDemoMode || isDemoFile) && (
              <p className="text-sm text-purple-600 mt-1">
                Showing demo analysis with sample marketing data
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DemoModeToggle isDemoMode={isDemoMode} onToggle={toggleDemoMode} />
          {analysis && (
            <Button variant="outline" onClick={() => setShowExportDialog(true)}>
              <Share2 className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Report Type</CardTitle>
            <CardDescription className="text-xs">
              Choose the type of data you uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={reportType} onValueChange={(value: 'ga4' | 'ads' | 'general') => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ga4">GA4 Report</SelectItem>
                <SelectItem value="ads">Ads Data</SelectItem>
                <SelectItem value="general">General Analytics</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analysis Focus</CardTitle>
            <CardDescription className="text-xs">
              What type of analysis do you want?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={analysisType} onValueChange={(value: 'insights' | 'recommendations' | 'summary') => setAnalysisType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="insights">Key Insights</SelectItem>
                <SelectItem value="recommendations">Recommendations</SelectItem>
                <SelectItem value="summary">Executive Summary</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex items-end">
          <Button onClick={handleAnalyze} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isDemoMode || isDemoFile ? 'Generating demo...' : 'Analyzing...'}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {isDemoMode || isDemoFile ? 'Regenerate Demo' : 'Analyze Data'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Data Filters */}
      <div className="mb-8">
        <DataFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          dataSummary={analysis?.dataSummary}
          isLoading={isLoading}
        />
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            {isDemoMode || isDemoFile 
              ? 'Generating demo analysis with AI...' 
              : 'Analyzing your data with AI...'
            }
          </p>
          <p className="text-sm text-gray-500">This may take up to 30 seconds</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
              {analysis.dataSummary && (
                <CardDescription>
                  Analyzing {analysis.dataSummary.filteredRows.toLocaleString()} of {analysis.dataSummary.totalRows.toLocaleString()} rows
                  {analysis.dataSummary.filteredRows !== analysis.dataSummary.totalRows && (
                    <span className="text-blue-600 ml-1">(filtered)</span>
                  )}
                  {(isDemoMode || isDemoFile) && (
                    <span className="text-purple-600 ml-2">• Demo Data</span>
                  )}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
            </CardContent>
          </Card>

          <ChartsGrid charts={analysis.charts} />

          <MetricsGrid metrics={analysis.keyMetrics} />

          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Insights</h2>
              {analysis.insights.length > 0 ? (
                <div className="space-y-4">
                  {analysis.insights.map((insight, index) => (
                    <InsightCard key={index} insight={insight} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No specific insights generated for this dataset.</p>
                    <p className="text-sm text-gray-400 mt-2">Try adjusting the analysis parameters or filters.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Recommendations</h2>
              {analysis.recommendations.length > 0 ? (
                <div className="space-y-4">
                  {analysis.recommendations.map((recommendation, index) => (
                    <RecommendationCard key={index} recommendation={recommendation} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">No specific recommendations generated for this dataset.</p>
                    <p className="text-sm text-gray-400 mt-2">Try adjusting the analysis parameters or filters.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {analysis && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          analysisData={analysis}
        />
      )}
    </div>
  );
}
