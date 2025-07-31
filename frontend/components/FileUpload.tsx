import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import { useDemoMode } from '../hooks/useDemoMode';

interface FileUploadProps {
  onUploadSuccess: (fileId: string) => void;
  onUploadError: (error: string) => void;
  isUploading: boolean;
  setIsUploading: (uploading: boolean) => void;
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

export default function FileUpload({ onUploadSuccess, onUploadError, isUploading, setIsUploading }: FileUploadProps) {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string>('');
  const [validationSuggestion, setValidationSuggestion] = useState<string>('');

  const validateFile = (file: File): ValidationResult => {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        isValid: false,
        error: `File size (${sizeMB}MB) exceeds the 10MB limit`,
        suggestion: 'Please reduce the file size or split your data into smaller files'
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: 'The selected file is empty',
        suggestion: 'Please select a file that contains data'
      };
    }

    // Check file extension
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      return {
        isValid: false,
        error: 'Unsupported file format',
        suggestion: `Please upload a file with one of these extensions: ${allowedExtensions.join(', ')}`
      };
    }

    // Check MIME type
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream' // Sometimes browsers don't detect CSV MIME type correctly
    ];

    if (!allowedTypes.includes(file.type) && file.type !== '') {
      return {
        isValid: false,
        error: 'File type not recognized as a valid CSV or Excel file',
        suggestion: 'Please ensure your file is saved as CSV, XLS, or XLSX format'
      };
    }

    return { isValid: true };
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);
    return interval;
  };

  const handleDemoUpload = async () => {
    setIsUploading(true);
    const progressInterval = simulateProgress();

    try {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Generate a demo file ID
      const demoFileId = `demo-file-${Date.now()}`;
      
      toast({
        title: "Demo file uploaded",
        description: "Using sample marketing data for demonstration.",
      });
      
      onUploadSuccess(demoFileId);
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = 'Demo upload simulation failed';
      setValidationError(errorMessage);
      setValidationSuggestion('Please try again');
      onUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Clear previous validation errors
    setValidationError('');
    setValidationSuggestion('');

    // In demo mode, use demo data instead of actual upload
    if (isDemoMode) {
      await handleDemoUpload();
      return;
    }

    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setValidationError('File is too large');
        setValidationSuggestion('Please select a file smaller than 10MB');
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setValidationError('Invalid file type');
        setValidationSuggestion('Please select a CSV or Excel file');
      } else {
        setValidationError('File was rejected');
        setValidationSuggestion('Please try selecting a different file');
      }
      return;
    }

    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error || 'File validation failed');
      setValidationSuggestion(validation.suggestion || 'Please try a different file');
      return;
    }

    setIsUploading(true);
    const progressInterval = simulateProgress();

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

          // Complete the progress bar
          clearInterval(progressInterval);
          setUploadProgress(100);

          const response = await backend.dashboard.upload({
            fileName: file.name,
            fileData: base64,
            fileType: file.type || 'text/csv'
          });

          onUploadSuccess(response.fileId);
        } catch (error) {
          console.error('Upload error:', error);
          
          // Parse backend error details
          if (error && typeof error === 'object' && 'details' in error) {
            const details = (error as any).details;
            if (details && typeof details === 'object') {
              setValidationError(details.message || 'Upload failed');
              setValidationSuggestion(details.suggestion || 'Please try again');
              onUploadError(details.message || 'Upload failed');
              return;
            }
          }

          const errorMessage = error instanceof Error ? error.message : 'Upload failed';
          setValidationError(errorMessage);
          setValidationSuggestion('Please try uploading the file again');
          onUploadError(errorMessage);
        } finally {
          clearInterval(progressInterval);
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      reader.onerror = () => {
        clearInterval(progressInterval);
        setIsUploading(false);
        setUploadProgress(0);
        setValidationError('Failed to read file');
        setValidationSuggestion('Please try selecting the file again');
        onUploadError('Failed to read file');
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      console.error('File reading error:', error);
      setValidationError('Failed to process file');
      setValidationSuggestion('Please try again with a different file');
      onUploadError('Failed to process file');
    }
  }, [onUploadSuccess, onUploadError, setIsUploading, isDemoMode, handleDemoUpload, toast]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  });

  const getDropzoneStyles = () => {
    if (isUploading) return 'border-blue-300 bg-blue-50';
    if (isDragReject) return 'border-red-400 bg-red-50';
    if (isDragActive) return 'border-blue-400 bg-blue-50';
    if (validationError) return 'border-red-300 bg-red-50';
    if (isDemoMode) return 'border-purple-300 bg-purple-50';
    return 'border-gray-300 hover:border-gray-400';
  };

  return (
    <div className="space-y-4">
      {isDemoMode && (
        <Alert className="border-purple-200 bg-purple-50">
          <AlertCircle className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-800">
            <strong>Demo Mode:</strong> File uploads will use sample marketing data for demonstration purposes.
          </AlertDescription>
        </Alert>
      )}

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${getDropzoneStyles()}
          ${isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 text-blue-500 mx-auto animate-spin" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  {isDemoMode ? 'Loading demo data...' : 'Uploading...'}
                </p>
                <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                <p className="text-sm text-gray-500">{Math.round(uploadProgress)}% complete</p>
              </div>
            </div>
          ) : isDragReject ? (
            <div className="space-y-2">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-lg font-medium text-red-900">Invalid file type</p>
              <p className="text-sm text-red-600">Please drop a CSV or Excel file</p>
            </div>
          ) : isDragActive ? (
            <div className="space-y-2">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-medium text-green-900">Drop your file here</p>
              <p className="text-sm text-green-600">Release to upload</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-lg font-medium text-gray-900">
                {isDemoMode ? 'Upload demo file' : 'Upload your report'}
              </p>
              <p className="text-sm text-gray-500">
                {isDemoMode ? 'Click to load sample marketing data' : 'Drag & drop or click to select'}
              </p>
              <p className="text-xs text-gray-400">
                CSV, XLS, XLSX • Max 10MB
              </p>
            </div>
          )}

          {!isUploading && !isDragActive && (
            <Button variant="outline" className="mt-4">
              <FileText className="h-4 w-4 mr-2" />
              {isDemoMode ? 'Load Demo File' : 'Choose File'}
            </Button>
          )}
        </div>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">{validationError}</p>
              {validationSuggestion && (
                <p className="text-sm opacity-90">{validationSuggestion}</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Supported formats:</strong> CSV, Excel (.xls, .xlsx)</p>
        <p><strong>File requirements:</strong> Must include header row and at least 2 data rows</p>
        <p><strong>Size limit:</strong> Maximum 10MB per file</p>
        {isDemoMode && (
          <p className="text-purple-600"><strong>Demo mode:</strong> Sample data will be used for analysis</p>
        )}
      </div>
    </div>
  );
}
