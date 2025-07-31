import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Calendar, Clock, TrendingUp, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import backend from '~backend/client';
import type { ScheduledJob } from '~backend/scheduler/schedule-manager';
import ScheduledJobCard from '../components/ScheduledJobCard';
import ScheduledJobDialog from '../components/ScheduledJobDialog';
import JobHistoryDialog from '../components/JobHistoryDialog';
import DemoModeToggle from '../components/DemoModeToggle';
import { useDemoMode } from '../hooks/useDemoMode';
import { demoScheduledJobs } from '../utils/demoData';

export default function SchedulingPage() {
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [historyJobId, setHistoryJobId] = useState<string>('');
  const [historyJobName, setHistoryJobName] = useState<string>('');

  const { data: jobsData, isLoading, error, refetch } = useQuery({
    queryKey: ['scheduled-jobs', isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 800));
        return { jobs: demoScheduledJobs, totalCount: demoScheduledJobs.length };
      }
      return backend.scheduler.scheduleManager.getScheduledJobs({});
    },
    refetchInterval: isDemoMode ? undefined : 30000, // Refetch every 30 seconds (only in non-demo mode)
  });

  const handleCreateJob = () => {
    setEditingJob(null);
    setShowCreateDialog(true);
  };

  const handleEditJob = (job: ScheduledJob) => {
    setEditingJob(job);
    setShowCreateDialog(true);
  };

  const handleViewHistory = (jobId: string, jobName: string) => {
    setHistoryJobId(jobId);
    setHistoryJobName(jobName);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingJob(null);
  };

  const handleCloseHistory = () => {
    setHistoryJobId('');
    setHistoryJobName('');
  };

  const handleJobSaved = () => {
    refetch();
    handleCloseDialog();
  };

  const getJobStats = () => {
    if (!jobsData?.jobs) return { total: 0, active: 0, paused: 0 };
    
    const total = jobsData.jobs.length;
    const active = jobsData.jobs.filter(job => job.isActive).length;
    const paused = total - active;
    
    return { total, active, paused };
  };

  const stats = getJobStats();

  if (error && !isDemoMode) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load scheduled jobs. Please try again or enable demo mode to see how it works.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Scheduled Jobs</h1>
          <p className="text-gray-600 mt-2">
            Automate your data fetching and analysis with scheduled jobs
            {isDemoMode && (
              <span className="text-purple-600 ml-2">• Demo Mode Active</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <DemoModeToggle isDemoMode={isDemoMode} onToggle={toggleDemoMode} />
          <Button onClick={handleCreateJob}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Jobs
              {isDemoMode && (
                <Badge variant="outline" className="text-purple-600">Demo</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Paused Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.paused}</div>
          </CardContent>
        </Card>
      </div>

      {/* Jobs List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isDemoMode ? 'Loading demo jobs...' : 'Loading scheduled jobs...'}
          </p>
        </div>
      ) : jobsData && jobsData.jobs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {jobsData.jobs.map((job) => (
            <ScheduledJobCard
              key={job.id}
              job={job}
              onUpdate={refetch}
              onEdit={handleEditJob}
              onViewHistory={(jobId) => handleViewHistory(jobId, job.name)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Jobs</h3>
            <p className="text-gray-600 mb-4">
              {isDemoMode 
                ? 'Create demo scheduled jobs to see how automation works.'
                : 'Create your first scheduled job to automate data fetching and analysis.'
              }
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleCreateJob}>
                <Plus className="h-4 w-4 mr-2" />
                {isDemoMode ? 'Create Demo Job' : 'Create Your First Job'}
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

      {/* Feature Information */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Automated Scheduling Features
            {isDemoMode && (
              <Badge variant="outline" className="text-purple-600">Demo Available</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Powerful automation capabilities for your marketing data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">📅 Flexible Scheduling</h4>
              <p className="text-sm text-gray-600">
                Set up daily, weekly, or monthly data fetching with custom times and timezones.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🤖 Auto-Analysis</h4>
              <p className="text-sm text-gray-600">
                Automatically generate AI-powered insights and recommendations from fetched data.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📧 Email Notifications</h4>
              <p className="text-sm text-gray-600">
                Get notified when new insights are available or when jobs complete.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📊 Historical Tracking</h4>
              <p className="text-sm text-gray-600">
                View execution history and track analysis results over time.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📈 Trend Comparisons</h4>
              <p className="text-sm text-gray-600">
                Compare current performance with previous periods to identify trends.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🔄 Reliable Execution</h4>
              <p className="text-sm text-gray-600">
                Robust job execution with error handling and retry mechanisms.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ScheduledJobDialog
        isOpen={showCreateDialog}
        onClose={handleCloseDialog}
        onSave={handleJobSaved}
        job={editingJob || undefined}
      />

      <JobHistoryDialog
        isOpen={!!historyJobId}
        onClose={handleCloseHistory}
        jobId={historyJobId}
        jobName={historyJobName}
      />
    </div>
  );
}
