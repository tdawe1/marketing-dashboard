import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { ScheduledJob } from '~backend/scheduler/schedule-manager';

interface ScheduledJobDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  job?: ScheduledJob;
  platform?: string;
  accountId?: string;
  accessToken?: string;
}

export default function ScheduledJobDialog({ 
  isOpen, 
  onClose, 
  onSave, 
  job, 
  platform, 
  accountId, 
  accessToken 
}: ScheduledJobDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'weekly' as 'daily' | 'weekly' | 'monthly',
    timeOfDay: '09:00',
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notificationEmail: '',
    autoAnalyze: true,
    analysisType: 'insights' as 'insights' | 'recommendations' | 'summary'
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setFormData({
        name: job.name,
        description: job.description || '',
        frequency: job.frequency,
        timeOfDay: job.timeOfDay,
        dayOfWeek: job.dayOfWeek || 1,
        dayOfMonth: job.dayOfMonth || 1,
        timezone: job.timezone,
        notificationEmail: job.notificationEmail || '',
        autoAnalyze: job.autoAnalyze,
        analysisType: job.analysisType
      });
    } else {
      // Reset form for new job
      setFormData({
        name: platform ? `${platform} - Weekly Report` : '',
        description: '',
        frequency: 'weekly',
        timeOfDay: '09:00',
        dayOfWeek: 1,
        dayOfMonth: 1,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notificationEmail: '',
        autoAnalyze: true,
        analysisType: 'insights'
      });
    }
  }, [job, platform]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the scheduled job.",
        variant: "destructive",
      });
      return;
    }

    if (!job && (!platform || !accountId || !accessToken)) {
      toast({
        title: "Missing platform data",
        description: "Platform, account ID, and access token are required for new jobs.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (job) {
        // Update existing job
        await backend.scheduler.scheduleManager.updateScheduledJob({
          jobId: job.id,
          name: formData.name,
          description: formData.description || undefined,
          frequency: formData.frequency,
          timeOfDay: formData.timeOfDay,
          dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : undefined,
          dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : undefined,
          timezone: formData.timezone,
          notificationEmail: formData.notificationEmail || undefined,
          autoAnalyze: formData.autoAnalyze,
          analysisType: formData.analysisType
        });

        toast({
          title: "Job updated",
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        // Create new job
        await backend.scheduler.scheduleManager.createScheduledJob({
          name: formData.name,
          description: formData.description || undefined,
          platform: platform as "google-analytics" | "google-ads" | "facebook-ads",
          accountId: accountId!,
          accessToken: accessToken!,
          frequency: formData.frequency,
          timeOfDay: formData.timeOfDay,
          dayOfWeek: formData.frequency === 'weekly' ? formData.dayOfWeek : undefined,
          dayOfMonth: formData.frequency === 'monthly' ? formData.dayOfMonth : undefined,
          timezone: formData.timezone,
          notificationEmail: formData.notificationEmail || undefined,
          autoAnalyze: formData.autoAnalyze,
          analysisType: formData.analysisType
        });

        toast({
          title: "Job created",
          description: `${formData.name} has been scheduled successfully.`,
        });
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Save job error:', error);
      toast({
        title: "Failed to save job",
        description: error instanceof Error ? error.message : 'Could not save scheduled job',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDayOfWeekOptions = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.map((day, index) => (
      <SelectItem key={index} value={index.toString()}>
        {day}
      </SelectItem>
    ));
  };

  const getDayOfMonthOptions = () => {
    const options = [];
    for (let i = 1; i <= 31; i++) {
      const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
      options.push(
        <SelectItem key={i} value={i.toString()}>
          {i}{suffix}
        </SelectItem>
      );
    }
    return options;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {job ? 'Edit Scheduled Job' : 'Create Scheduled Job'}
          </DialogTitle>
          <DialogDescription>
            {job 
              ? 'Update the settings for your scheduled job.'
              : 'Set up automated data fetching and analysis for your connected platform.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            <div>
              <Label htmlFor="name">Job Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Weekly GA4 Report"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this job does..."
                rows={2}
              />
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="frequency">Frequency</Label>
                <Select 
                  value={formData.frequency} 
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                    setFormData({ ...formData, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timeOfDay">Time of Day</Label>
                <Input
                  id="timeOfDay"
                  type="time"
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                />
              </div>
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <Label htmlFor="dayOfWeek">Day of Week</Label>
                <Select 
                  value={formData.dayOfWeek.toString()} 
                  onValueChange={(value) => 
                    setFormData({ ...formData, dayOfWeek: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getDayOfWeekOptions()}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.frequency === 'monthly' && (
              <div>
                <Label htmlFor="dayOfMonth">Day of Month</Label>
                <Select 
                  value={formData.dayOfMonth.toString()} 
                  onValueChange={(value) => 
                    setFormData({ ...formData, dayOfMonth: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getDayOfMonthOptions()}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                placeholder="e.g., America/New_York"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
          </div>

          {/* Analysis Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Analysis Settings
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoAnalyze">Auto-analyze Data</Label>
                <p className="text-sm text-gray-600">
                  Automatically run AI analysis on fetched data
                </p>
              </div>
              <Switch
                id="autoAnalyze"
                checked={formData.autoAnalyze}
                onCheckedChange={(checked) => setFormData({ ...formData, autoAnalyze: checked })}
              />
            </div>

            {formData.autoAnalyze && (
              <div>
                <Label htmlFor="analysisType">Analysis Type</Label>
                <Select 
                  value={formData.analysisType} 
                  onValueChange={(value: 'insights' | 'recommendations' | 'summary') => 
                    setFormData({ ...formData, analysisType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="insights">Key Insights</SelectItem>
                    <SelectItem value="recommendations">Recommendations</SelectItem>
                    <SelectItem value="summary">Executive Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Notifications
            </h3>

            <div>
              <Label htmlFor="notificationEmail">Email Address (Optional)</Label>
              <Input
                id="notificationEmail"
                type="email"
                value={formData.notificationEmail}
                onChange={(e) => setFormData({ ...formData, notificationEmail: e.target.value })}
                placeholder="your@email.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Receive email notifications when new insights are available
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
