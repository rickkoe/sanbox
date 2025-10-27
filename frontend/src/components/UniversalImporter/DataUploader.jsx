import React, { useRef, useCallback, useState } from 'react';
import {
  Upload,
  File,
  FileText,
  X,
  AlertCircle
} from 'lucide-react';

const DataUploader = ({
  sourceType,
  onSourceTypeChange,
  uploadedFiles,
  onFilesChange,
  pastedText,
  onTextChange,
  loading,
  error
}) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Handle file selection
  const handleFileSelect = useCallback((files) => {
    if (files && files.length > 0) {
      onFilesChange([files[0]]); // Only take the first file
    }
  }, [onFilesChange]);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files);
  };

  // Handle click to open file selector
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Remove uploaded file
  const handleRemoveFile = () => {
    onFilesChange([]);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="data-uploader">
      {/* Source Type Tabs */}
      <div className="source-type-tabs">
        <button
          className={`source-tab ${sourceType === 'file' ? 'active' : ''}`}
          onClick={() => onSourceTypeChange('file')}
        >
          <Upload size={18} />
          Upload File
        </button>
        <button
          className={`source-tab ${sourceType === 'paste' ? 'active' : ''}`}
          onClick={() => onSourceTypeChange('paste')}
        >
          <FileText size={18} />
          Paste Text
        </button>
      </div>

      {/* File Upload Mode */}
      {sourceType === 'file' && (
        <>
          {uploadedFiles.length === 0 ? (
            <div
              className={`upload-zone ${isDragging ? 'dragover' : ''}`}
              onClick={handleUploadClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="upload-icon" />
              <div className="upload-text">
                Drop your file here, or click to browse
              </div>
              <div className="upload-hint">
                Supports: .txt, .log, .csv files (Max 100MB)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.log,.csv"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </div>
          ) : (
            <div className="file-preview">
              <File className="file-icon" size={32} />
              <div className="file-info">
                <div className="file-name">{uploadedFiles[0].name}</div>
                <div className="file-size">
                  {formatFileSize(uploadedFiles[0].size)}
                </div>
              </div>
              <button
                className="file-remove"
                onClick={handleRemoveFile}
                aria-label="Remove file"
              >
                <X size={20} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Text Paste Mode */}
      {sourceType === 'paste' && (
        <div className="text-input-container">
          <textarea
            className="text-input"
            placeholder="Paste your configuration data here...

Examples:
• Cisco: show running-config or show tech-support output
• Brocade: cfgshow or SAN Health CSV files
• Storage Insights: Leave this empty and provide credentials in next step"
            value={pastedText}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={loading}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="alert alert-danger">
          <AlertCircle className="alert-icon" size={20} />
          <div className="alert-content">
            <div className="alert-title">Upload Error</div>
            <div className="alert-message">{error}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataUploader;
