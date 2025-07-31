import React, { useState } from 'react';
import { Calendar, Clock, Play, Pause, Settings, Trash2, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { ScheduledJob } from '~backend/scheduler/schedule-manager';
import { useDemoMode } from '../hooks/useDemoMode';

interface ScheduledJobCardProps {
  job: ScheduledJob;
  onUpdate: () => void;
  onEdit: (job: ScheduledJob) => void;
  onViewHistory: (jobId: string) => void;
}

export default function ScheduledJobCard({ job, onUpdate, onEdit, onViewHistory }: ScheduledJobCardProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const [isToggling, setIsToggling] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleToggleActive = async () => {
    if (isDemoMode) {
      toast({
        title: job.isActive ? "Demo job paused" : "Demo job activated",
        description: `${job.name} status change simulated in demo mode.`,
      });
      return;
    }

    setIsToggling(true);
    try {
      await backend.scheduler.scheduleManager.updateScheduledJob({
        jobId: job.id,
        isActive: !job.isActive
      });
      
      toast({
        title: job.isActive ? "Job paused" : "Job activated",
        description: `${job.name} has been ${job.isActive ? 'paused' : 'activated'}.`,
      });
      
      onUpdate();
    } catch (error) {
      console.error('Toggle job error:', error);
      toast({
        title: "Failed to update job",
        description: error instanceof Error ? error.message : 'Could not update job status',
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleTriggerExecution = async () => {
    if (isDemoMode) {
      toast({
        title: "Demo job triggered",
        description: `${job.name} execution simulated in demo mode.`,
      });
      return;
    }

    setIsTriggering(true);
    try {
      await backend.scheduler.scheduleManager.triggerJobExecution({
        jobId: job.id
      });
      
      toast({
        title: "Job triggered",
        description: `${job.name} has been manually triggered and is now running.`,
      });
      
      onUpdate();
    } catch (error) {
      console.error('Trigger job error:', error);
      toast({
        title: "Failed to trigger job",
        description: error instanceof Error ? error.message : 'Could not trigger job execution',
        variant: "destructive",
      });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${job.name}"? This action cannot be undone.`)) {
      return;
    }

    if (isDemoMode) {
      toast({
        title: "Demo job deleted",
        description: `${job.name} deletion simulated in demo mode.`,
      });
      return;
    }

    setIsDeleting(true);
    try {
      await backend.scheduler.scheduleManager.deleteScheduledJob({
        jobId: job.id
      });
      
      toast({
        title: "Job deleted",
        description: `${job.name} has been deleted.`,
      });
      
      onUpdate();
    } catch (error) {
      console.error('Delete job error:', error);
      toast({
        title: "Failed to delete job",
        description: error instanceof Error ? error.message : 'Could not delete job',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
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

  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'daily':
        return 'bg-green-100 text-green-800';
      case 'weekly':
        return 'bg-blue-100 text-blue-800';
      case 'monthly':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatNextRun = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) {
      return 'Overdue';
    } else if (diffHours < 1) {
      return 'Within 1 hour';
    } else if (diffHours < 24) {
      return `In ${diffHours} hours`;
    } else if (diffDays === 1) {
      return 'Tomorrow';
    } else {
      return `In ${diffDays} days`;
    }
  };

  const getScheduleDescription = () => {
    const time = job.timeOfDay;
    
    switch (job.frequency) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = job.dayOfWeek !== undefined ? days[job.dayOfWeek] : 'Unknown';
        return `Weekly on ${dayName} at ${time}`;
      case 'monthly':
        const suffix = job.dayOfMonth === 1 ? 'st' : job.dayOfMonth === 2 ? 'nd' : job.dayOfMonth === 3 ? 'rd' : 'th';
        return `Monthly on the ${job.dayOfMonth}${suffix} at ${time}`;
      default:
        return `${job.frequency} at ${time}`;
    }
  };

  return (
    <Card className={`relative ${job.isActive ? 'border-green-200' : 'border-gray-200'}`}>
      <div className={`absolute top-0 left-0 w-full h-1 ${job.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
      
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="text-lg">{getPlatformIcon(job.platform)}</span>
            <div>
              <h3 className="font-semibold">{job.name}</h3>
              {job.description && (
                <p className="text-sm text-gray-600 font-normal">{job.description}</p>
              )}
            </div>
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={job.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isToggling}
            />
            {job.isActive ? (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Pause className="h-3 w-3 mr-1" />
                Paused
              </Badge>
            )}
            {isDemoMode && (
              <Badge variant="outline" className="text-purple-600">
                Demo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Platform and Schedule Info */}
        <div className="flex flex-wrap gap-2">
          <Badge className={getPlatformColor(job.platform)}>
            {job.platform}
          </Badge>
          <Badge className={getFrequencyColor(job.frequency)}>
            <Calendar className="h-3 w-3 mr-1" />
            {job.frequency}
          </Badge>
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {job.timeOfDay}
          </Badge>
          {job.autoAnalyze && (
            <Badge className="bg-purple-100 text-purple-800">
              <TrendingUp className="h-3 w-3 mr-1" />
              Auto-analyze
            </Badge>
          )}
        </div>

        {/* Schedule Description */}
        <div className="text-sm text-gray-600">
          <p>{getScheduleDescription()}</p>
          <p>Timezone: {job.timezone}</p>
        </div>

        {/* Next Run */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Next Run</div>
              <div className="text-xs text-gray-600">
                {job.nextRun.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{formatNextRun(job.nextRun)}</div>
              {job.lastRun && (
                <div className="text-xs text-gray-600">
                  Last: {job.lastRun.toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        {job.notificationEmail && (
          <div className="text-xs text-gray-600">
            📧 Notifications: {job.notificationEmail}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerExecution}
            disabled={isTriggering || !job.isActive}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            {isTriggering ? 'Running...' : 'Run Now'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewHistory(job.id)}
            className="flex-1"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            History
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(job)}
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
