import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, CheckCircle, XCircle, Play, TrendingUp, FileText, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { JobExecution, HistoricalAnalysis } from '~backend/scheduler/schedule-manager';

interface JobHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobName: string;
}

export default function JobHistoryDialog({ isOpen, onClose, jobId, jobName }: JobHistoryDialogProps) {
  const { toast } = useToast();
  const [selectedAnalysis, setSelectedAnalysis] = useState<HistoricalAnalysis | null>(null);

  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['job-executions', jobId],
    queryFn: () => backend.scheduler.scheduleManager.getJobExecutions({ jobId }),
    enabled: isOpen
  });

  const { data: analyses, isLoading: analysesLoading } = useQuery({
    queryKey: ['historical-analyses', jobId],
    queryFn: () => backend.scheduler.scheduleManager.getHistoricalAnalyses({ jobId }),
    enabled: isOpen
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <Play className="h-4 w-4 text-blue-600 animate-pulse" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const handleGenerateTrendComparison = async (currentId: string, previousId: string) => {
    try {
      const comparison = await backend.scheduler.scheduleManager.generateTrendComparison({
        jobId,
        currentAnalysisId: currentId,
        previousAnalysisId: previousId
      });

      toast({
        title: "Trend comparison generated",
        description: `Found ${comparison.insights.length} metric changes to analyze.`,
      });

      // You could open a separate dialog or navigate to show the comparison
      console.log('Trend comparison:', comparison);
    } catch (error) {
      console.error('Generate trend comparison error:', error);
      toast({
        title: "Failed to generate comparison",
        description: error instanceof Error ? error.message : 'Could not generate trend comparison',
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Job History: {jobName}</DialogTitle>
          <DialogDescription>
            View execution history and analysis results for this scheduled job.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="executions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="executions">Executions</TabsTrigger>
            <TabsTrigger value="analyses">Analyses</TabsTrigger>
          </TabsList>

          <TabsContent value="executions" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Execution History</h3>
              
              {executionsLoading ? (
                <div className="text-center py-8">Loading executions...</div>
              ) : executions && executions.executions.length > 0 ? (
                <div className="space-y-3">
                  {executions.executions.map((execution) => (
                    <Card key={execution.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(execution.status)}
                            <div>
                              <div className="font-medium">
                                Execution #{execution.id}
                              </div>
                              <div className="text-sm text-gray-600">
                                Started: {execution.startedAt.toLocaleString()}
                              </div>
                              {execution.completedAt && (
                                <div className="text-sm text-gray-600">
                                  Completed: {execution.completedAt.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <Badge className={getStatusColor(execution.status)}>
                              {execution.status}
                            </Badge>
                            {execution.executionTimeMs && (
                              <div className="text-sm text-gray-600 mt-1">
                                Duration: {formatDuration(execution.executionTimeMs)}
                              </div>
                            )}
                          </div>
                        </div>

                        {execution.rowsFetched && (
                          <div className="mt-2 text-sm text-gray-600">
                            📊 Fetched {execution.rowsFetched.toLocaleString()} rows
                          </div>
                        )}

                        {execution.errorMessage && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                            Error: {execution.errorMessage}
                          </div>
                        )}

                        {execution.analysisId && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-purple-600">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Analysis Available
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No executions found for this job.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analyses" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Analysis History</h3>
              
              {analysesLoading ? (
                <div className="text-center py-8">Loading analyses...</div>
              ) : analyses && analyses.analyses.length > 0 ? (
                <div className="space-y-3">
                  {analyses.analyses.map((analysis, index) => (
                    <Card key={analysis.id} className="cursor-pointer hover:bg-gray-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">
                                Analysis #{analysis.id.slice(-8)}
                              </div>
                              <div className="text-sm text-gray-600">
                                {analysis.dateRangeStart} to {analysis.dateRangeEnd}
                              </div>
                              <div className="text-sm text-gray-600">
                                Created: {analysis.createdAt.toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="text-sm text-gray-600">
                              {analysis.totalRows.toLocaleString()} rows
                            </div>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline">
                                {analysis.insightsCount} insights
                              </Badge>
                              <Badge variant="outline">
                                {analysis.recommendationsCount} recommendations
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Key Metrics Preview */}
                        {analysis.keyMetrics && Object.keys(analysis.keyMetrics).length > 0 && (
                          <div className="mt-3 pt-3 border-t">
                            <div className="text-sm font-medium mb-2">Key Metrics</div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {Object.entries(analysis.keyMetrics).slice(0, 4).map(([key, value]) => (
                                <div key={key}>
                                  <div className="text-gray-600">{key}</div>
                                  <div className="font-medium">
                                    {typeof value === 'number' ? value.toLocaleString() : value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Trend Comparison Button */}
                        {index < analyses.analyses.length - 1 && (
                          <div className="mt-3 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateTrendComparison(
                                analysis.id,
                                analyses.analyses[index + 1].id
                              )}
                            >
                              <TrendingUp className="h-4 w-4 mr-2" />
                              Compare with Previous
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No analyses found for this job.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
