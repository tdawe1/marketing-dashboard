import { api, APIError } from "encore.dev/api";
import { Bucket } from "encore.dev/storage/objects";

const reportsBucket = new Bucket("reports");

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];

const SUPPORTED_EXTENSIONS = ['.csv', '.xls', '.xlsx'];

export interface UploadRequest {
  fileName: string;
  fileData: string; // base64 encoded file data
  fileType: string;
}

export interface UploadResponse {
  fileId: string;
  fileName: string;
  uploadedAt: Date;
}

export interface ValidationError {
  code: string;
  message: string;
  suggestion: string;
}

// Uploads a CSV or Excel file for analysis.
export const upload = api<UploadRequest, UploadResponse>(
  { expose: true, method: "POST", path: "/upload" },
  async (req) => {
    try {
      // Validate input parameters
      if (!req.fileName || !req.fileData || !req.fileType) {
        throw APIError.invalidArgument("Missing required fields", {
          code: "MISSING_FIELDS",
          message: "File name, data, and type are required",
          suggestion: "Please ensure all file information is provided"
        });
      }

      // Validate file name
      const fileName = req.fileName.trim();
      if (fileName.length === 0) {
        throw APIError.invalidArgument("Invalid file name", {
          code: "INVALID_FILENAME",
          message: "File name cannot be empty",
          suggestion: "Please provide a valid file name"
        });
      }

      // Validate file extension
      const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
      if (!SUPPORTED_EXTENSIONS.includes(fileExtension)) {
        throw APIError.invalidArgument("Unsupported file format", {
          code: "UNSUPPORTED_FORMAT",
          message: `File extension '${fileExtension}' is not supported`,
          suggestion: `Please upload a file with one of these extensions: ${SUPPORTED_EXTENSIONS.join(', ')}`
        });
      }

      // Validate MIME type
      if (!SUPPORTED_MIME_TYPES.includes(req.fileType) && req.fileType !== 'application/octet-stream') {
        throw APIError.invalidArgument("Unsupported file type", {
          code: "UNSUPPORTED_MIME_TYPE",
          message: `MIME type '${req.fileType}' is not supported`,
          suggestion: "Please upload a CSV or Excel file"
        });
      }

      // Decode and validate file data
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(req.fileData, 'base64');
      } catch (error) {
        throw APIError.invalidArgument("Invalid file data", {
          code: "INVALID_FILE_DATA",
          message: "File data is not properly encoded",
          suggestion: "Please try uploading the file again"
        });
      }

      // Validate file size
      if (fileBuffer.length === 0) {
        throw APIError.invalidArgument("Empty file", {
          code: "EMPTY_FILE",
          message: "The uploaded file is empty",
          suggestion: "Please upload a file that contains data"
        });
      }

      if (fileBuffer.length > MAX_FILE_SIZE) {
        const sizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
        const maxSizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
        throw APIError.invalidArgument("File too large", {
          code: "FILE_TOO_LARGE",
          message: `File size (${sizeMB}MB) exceeds the maximum limit of ${maxSizeMB}MB`,
          suggestion: "Please reduce the file size or split the data into smaller files"
        });
      }

      // Validate file content for CSV files
      if (fileExtension === '.csv' || req.fileType === 'text/csv') {
        try {
          validateCSVContent(fileBuffer);
        } catch (error) {
          if (error instanceof Error) {
            throw APIError.invalidArgument("Invalid CSV format", {
              code: "INVALID_CSV",
              message: error.message,
              suggestion: "Please ensure your CSV file is properly formatted with headers and data rows"
            });
          }
          throw error;
        }
      }

      // Generate unique file ID
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const storagePath = `${fileId}-${fileName}`;

      // Upload to storage
      try {
        await reportsBucket.upload(storagePath, fileBuffer, {
          contentType: req.fileType
        });
      } catch (error) {
        throw APIError.internal("Storage upload failed", {
          code: "STORAGE_ERROR",
          message: "Failed to save file to storage",
          suggestion: "Please try uploading again. If the problem persists, contact support"
        });
      }

      return {
        fileId,
        fileName,
        uploadedAt: new Date()
      };
    } catch (error) {
      // Re-throw APIErrors as-is
      if (error instanceof APIError) {
        throw error;
      }

      // Handle unexpected errors
      throw APIError.internal("Upload processing failed", {
        code: "UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
        suggestion: "Please try again. If the problem persists, contact support"
      });
    }
  }
);

function validateCSVContent(fileBuffer: Buffer): void {
  const content = fileBuffer.toString('utf-8');
  
  // Check for common encoding issues
  if (content.includes('\uFFFD')) {
    throw new Error("File contains invalid characters. Please ensure the file is saved in UTF-8 encoding");
  }

  // Split into lines and validate structure
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    throw new Error("CSV file appears to be empty");
  }

  if (lines.length === 1) {
    throw new Error("CSV file contains only headers. Please include data rows");
  }

  // Validate header row
  const headerLine = lines[0];
  if (!headerLine || headerLine.trim().length === 0) {
    throw new Error("CSV file is missing a header row");
  }

  const headers = headerLine.split(',').map(h => h.trim());
  if (headers.length < 2) {
    throw new Error("CSV file must contain at least 2 columns");
  }

  // Check for empty headers
  const emptyHeaders = headers.filter(h => h.length === 0);
  if (emptyHeaders.length > 0) {
    throw new Error("CSV file contains empty column headers");
  }

  // Validate data rows (check first few rows for consistency)
  const dataLines = lines.slice(1, Math.min(6, lines.length));
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const columns = line.split(',');
    
    if (columns.length !== headers.length) {
      throw new Error(`Row ${i + 2} has ${columns.length} columns but header has ${headers.length} columns. Please ensure all rows have the same number of columns`);
    }
  }

  // Check for minimum data requirements
  if (lines.length < 3) {
    throw new Error("CSV file should contain at least 2 data rows for meaningful analysis");
  }

  // Validate file size vs content
  if (content.length < 50) {
    throw new Error("CSV file appears to be too small to contain meaningful data");
  }
}
