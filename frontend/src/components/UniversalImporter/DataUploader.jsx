import React, { useRef, useCallback, useState } from 'react';
import {
  Upload,
  File,
  FileText,
  X,
  AlertCircle,
  Plus
} from 'lucide-react';

// Constants for file limits
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

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
  const [fileError, setFileError] = useState(null);

  // Calculate total size of uploaded files
  const totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);

  // Handle file selection - now supports multiple files
  const handleFileSelect = useCallback((files) => {
    if (!files || files.length === 0) return;

    setFileError(null);
    const newFiles = Array.from(files);
    const combinedFiles = [...uploadedFiles, ...newFiles];

    // Check file count limit
    if (combinedFiles.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed. You have ${combinedFiles.length}.`);
      return;
    }

    // Check total size limit
    const newTotalSize = combinedFiles.reduce((sum, file) => sum + file.size, 0);
    if (newTotalSize > MAX_TOTAL_SIZE) {
      setFileError(`Total file size exceeds 100MB limit.`);
      return;
    }

    onFilesChange(combinedFiles);
  }, [onFilesChange, uploadedFiles]);

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

  // Remove a specific file by index
  const handleRemoveFile = (index) => {
    setFileError(null);
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  // Clear all files
  const handleClearAll = () => {
    setFileError(null);
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
          {/* Drop zone - always visible when no files or for adding more */}
          <div
            className={`upload-zone ${isDragging ? 'dragover' : ''} ${uploadedFiles.length > 0 ? 'compact' : ''}`}
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploadedFiles.length === 0 ? (
              <>
                <Upload className="upload-icon" />
                <div className="upload-text">
                  Drop your files here, or click to browse
                </div>
                <div className="upload-hint">
                  Supports: .txt, .log, .csv files (Max 10 files, 100MB total)
                </div>
              </>
            ) : (
              <>
                <Plus size={20} />
                <span style={{ marginLeft: '0.5rem' }}>Add more files</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.log,.csv"
              multiple
              onChange={handleFileInputChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* File list */}
          {uploadedFiles.length > 0 && (
            <div className="file-list">
              {/* Header with count and clear all */}
              <div className="file-list-header">
                <span className="file-count">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} selected
                  <span className="total-size">({formatFileSize(totalSize)})</span>
                </span>
                <button
                  className="clear-all-btn"
                  onClick={handleClearAll}
                  type="button"
                >
                  Clear All
                </button>
              </div>

              {/* Individual files */}
              {uploadedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="file-preview">
                  <File className="file-icon" size={24} />
                  <div className="file-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{formatFileSize(file.size)}</div>
                  </div>
                  <button
                    className="file-remove"
                    onClick={() => handleRemoveFile(index)}
                    aria-label={`Remove ${file.name}`}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* File error display */}
          {fileError && (
            <div className="file-error">
              <AlertCircle size={16} />
              <span>{fileError}</span>
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
