import React, { useState } from 'react';
import { Download, Mail, Share2, FileText, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { AnalyzeResponse } from '~backend/dashboard/analyze';
import { useDemoMode } from '../hooks/useDemoMode';
import { demoExportContent } from '../utils/demoData';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  analysisData: AnalyzeResponse;
}

export default function ExportDialog({ isOpen, onClose, analysisData }: ExportDialogProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const [format, setFormat] = useState<'email' | 'linkedin' | 'report'>('email');
  const [reportTitle, setReportTitle] = useState('Marketing Analysis Report');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedContent, setExportedContent] = useState<string>('');

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (isDemoMode) {
        // Simulate export delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const content = demoExportContent[format];
        setExportedContent(content);
        
        toast({
          title: "Demo export successful",
          description: `Your demo ${format} format is ready to copy.`,
        });
      } else {
        const response = await backend.dashboard.exportAnalysis({
          analysisData,
          format,
          reportTitle
        });

        setExportedContent(response.content);
        
        toast({
          title: "Export successful",
          description: `Your ${format} format is ready to copy.`,
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : 'Export failed',
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportedContent);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied to your clipboard.",
    });
  };

  const downloadAsFile = () => {
    const blob = new Blob([exportedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}.${format === 'report' ? 'md' : 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getFormatIcon = (formatType: string) => {
    switch (formatType) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'linkedin':
        return <Share2 className="h-4 w-4" />;
      case 'report':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Analysis</DialogTitle>
          <DialogDescription>
            Choose your export format and customize the content for sharing.
            {isDemoMode && (
              <span className="text-purple-600 block mt-1">
                Demo mode: Using sample export content for demonstration.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Report Title</Label>
            <Input
              id="title"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Enter report title"
            />
          </div>

          <div>
            <Label htmlFor="format">Export Format</Label>
            <Select value={format} onValueChange={(value: 'email' | 'linkedin' | 'report') => setFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Summary
                  </div>
                </SelectItem>
                <SelectItem value="linkedin">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    LinkedIn Post
                  </div>
                </SelectItem>
                <SelectItem value="report">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Detailed Report
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleExport} disabled={isExporting} className="flex-1">
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isDemoMode ? 'Generating demo...' : 'Generating...'}
                </>
              ) : (
                <>
                  {getFormatIcon(format)}
                  <span className="ml-2">Generate {format}</span>
                </>
              )}
            </Button>
          </div>

          {exportedContent && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="content">Generated Content</Label>
                <Textarea
                  id="content"
                  value={exportedContent}
                  readOnly
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                  Copy to Clipboard
                </Button>
                <Button onClick={downloadAsFile} variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
