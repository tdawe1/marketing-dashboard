import React, { useState } from 'react';
import { Plus, Upload, Link, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import FileUpload from './FileUpload';
import IntegrationsGrid from './IntegrationsGrid';

interface SourceManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded: () => void;
  onNavigateToAnalysis?: (fileId: string) => void;
}

export default function SourceManagementDialog({ 
  isOpen, 
  onClose, 
  onSourceAdded,
  onNavigateToAnalysis 
}: SourceManagementDialogProps) {
  const { toast } = useToast();
  const [sourceName, setSourceName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleFileUploadSuccess = async (fileId: string) => {
    if (!sourceName.trim()) {
      setSourceName(`Uploaded File - ${new Date().toLocaleDateString()}`);
    }

    setIsAdding(true);
    try {
      await backend.dashboard.unifiedMetrics.addMetricSource({
        name: sourceName || `Uploaded File - ${new Date().toLocaleDateString()}`,
        type: 'file',
        platform: 'manual',
        fileId
      });

      toast({
        title: "Source added successfully",
        description: "Your file has been added to the unified dashboard.",
      });

      onSourceAdded();
      
      // Navigate to analysis if callback provided
      if (onNavigateToAnalysis) {
        onNavigateToAnalysis(fileId);
      }
    } catch (error) {
      console.error('Add source error:', error);
      toast({
        title: "Failed to add source",
        description: error instanceof Error ? error.message : 'Could not add data source',
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleFileUploadError = (error: string) => {
    toast({
      title: "Upload failed",
      description: error,
      variant: "destructive",
    });
  };

  const handleIntegrationDataFetched = async (fileId: string) => {
    // Integration data is automatically processed, just close dialog
    toast({
      title: "Integration data fetched",
      description: "Your platform data has been added to the unified dashboard.",
    });
    
    onSourceAdded();
    
    // Navigate to analysis if callback provided
    if (onNavigateToAnalysis) {
      onNavigateToAnalysis(fileId);
    }
  };

  const resetForm = () => {
    setSourceName('');
    setIsUploading(false);
    setIsAdding(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Data Source</DialogTitle>
          <DialogDescription>
            Add a new data source to your unified dashboard for cross-platform analysis.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="integration" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Connect Platform
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-6 space-y-4">
            <div>
              <Label htmlFor="sourceName">Source Name</Label>
              <Input
                id="sourceName"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g., Q4 2024 GA4 Data, Facebook Ads Campaign"
              />
              <p className="text-xs text-gray-500 mt-1">
                Give your data source a descriptive name for easy identification
              </p>
            </div>

            <FileUpload
              onUploadSuccess={handleFileUploadSuccess}
              onUploadError={handleFileUploadError}
              isUploading={isUploading}
              setIsUploading={setIsUploading}
            />

            {isAdding && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Adding source to dashboard...</span>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="integration" className="mt-6">
            <IntegrationsGrid onDataFetched={handleIntegrationDataFetched} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
