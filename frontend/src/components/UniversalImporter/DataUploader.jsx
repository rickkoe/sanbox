import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  File,
  FileText,
  FileCode,
  FileSearch,
  X,
  CheckCircle,
  AlertCircle,
  Copy,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import './styles/DataUploader.css';

const DataUploader = ({
  sourceType,
  onSourceTypeChange,
  uploadedFiles,
  onFilesChange,
  pastedText,
  onTextChange,
  onPreview,
  loading,
  error,
  theme
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  // File type icons
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['txt', 'log'].includes(ext)) return FileText;
    if (['csv', 'conf', 'cfg'].includes(ext)) return FileCode;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle drag events
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === e.currentTarget) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesChange(files);
    }
  }, [onFilesChange]);

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      onFilesChange(files);
    }
  };

  // Remove file
  const removeFile = (index) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  // Copy example text
  const copyExample = () => {
    const exampleText = `zone name Zone_Server1 vsan 100
  member pwwn 10:00:00:00:00:00:00:01
  member pwwn 10:00:00:00:00:00:00:02

zone name Zone_Server2 vsan 100
  member pwwn 10:00:00:00:00:00:00:03
  member pwwn 10:00:00:00:00:00:00:04`;

    navigator.clipboard.writeText(exampleText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`data-uploader theme-${theme}`}>
      {/* Tab Selector */}
      <div className="uploader-tabs">
        <button
          className={`tab-button ${sourceType === 'file' ? 'active' : ''}`}
          onClick={() => onSourceTypeChange('file')}
        >
          <Upload size={18} />
          <span>Upload File</span>
        </button>
        <button
          className={`tab-button ${sourceType === 'paste' ? 'active' : ''}`}
          onClick={() => onSourceTypeChange('paste')}
        >
          <FileText size={18} />
          <span>Paste Text</span>
        </button>
      </div>

      {/* File Upload Section */}
      {sourceType === 'file' && (
        <div className="upload-section">
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''} ${
              uploadedFiles.length > 0 ? 'has-files' : ''
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.csv,.log,.conf,.cfg"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Dropzone Background Effects */}
            <div className="dropzone-bg-pattern" />
            <div className="dropzone-border" />
            <div className="dropzone-glow" />

            {uploadedFiles.length === 0 ? (
              <div className="dropzone-content">
                <div className="dropzone-icon">
                  <Upload size={48} strokeWidth={1.5} />
                </div>
                <h3>Drop files here or click to browse</h3>
                <p>Supports .txt, .csv, .log, .conf, .cfg files</p>
                <div className="supported-formats">
                  <div className="format-chip">Cisco MDS</div>
                  <div className="format-chip">Brocade</div>
                  <div className="format-chip">CSV</div>
                </div>
              </div>
            ) : (
              <div className="files-preview">
                {uploadedFiles.map((file, index) => {
                  const Icon = getFileIcon(file.name);
                  return (
                    <div key={index} className="file-item">
                      <div className="file-icon">
                        <Icon size={24} />
                      </div>
                      <div className="file-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-size">{formatFileSize(file.size)}</div>
                      </div>
                      <button
                        className="file-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  );
                })}
                <div className="add-more">
                  <Upload size={16} />
                  <span>Click to add more files</span>
                </div>
              </div>
            )}
          </div>

          {/* File Upload Tips */}
          <div className="upload-tips">
            <div className="tip-item">
              <CheckCircle size={16} />
              <span>Maximum file size: 10MB</span>
            </div>
            <div className="tip-item">
              <CheckCircle size={16} />
              <span>Multiple files supported</span>
            </div>
            <div className="tip-item">
              <CheckCircle size={16} />
              <span>Automatic format detection</span>
            </div>
          </div>
        </div>
      )}

      {/* Text Paste Section */}
      {sourceType === 'paste' && (
        <div className={`paste-section ${isFullscreen ? 'fullscreen' : ''}`}>
          <div className="paste-header">
            <div className="paste-title">
              <h3>Paste Configuration Text</h3>
              <p>Paste your SAN configuration directly from your switch CLI</p>
            </div>
            <div className="paste-actions">
              <button
                className="action-button"
                onClick={copyExample}
                title="Copy example"
              >
                {copySuccess ? <CheckCircle size={18} /> : <Copy size={18} />}
                <span>{copySuccess ? 'Copied!' : 'Example'}</span>
              </button>
              <button
                className="action-button"
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
            </div>
          </div>

          <div className="editor-container">
            <div className="editor-gutter">
              {pastedText.split('\n').map((_, index) => (
                <div key={index} className="line-number">
                  {index + 1}
                </div>
              ))}
            </div>
            <textarea
              ref={textAreaRef}
              className="code-editor"
              value={pastedText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder={`Paste your configuration here...

Example (Cisco MDS):
zone name Zone_Server1 vsan 100
  member pwwn 10:00:00:00:00:00:00:01
  member pwwn 10:00:00:00:00:00:00:02

Example (Brocade):
zone: Zone_Server1
  10:00:00:00:00:00:00:01
  10:00:00:00:00:00:00:02`}
              spellCheck={false}
            />
          </div>

          <div className="paste-footer">
            <div className="char-count">
              {pastedText.length} characters • {pastedText.split('\n').length} lines
            </div>
            <div className="paste-tips">
              <span>💡 Tip: Copy directly from SSH terminal or config file</span>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="upload-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Button */}
      <div className="uploader-footer">
        <button
          className="preview-button"
          onClick={onPreview}
          disabled={
            loading ||
            (sourceType === 'file' && uploadedFiles.length === 0) ||
            (sourceType === 'paste' && !pastedText.trim())
          }
        >
          {loading ? (
            <>
              <div className="spinner" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <FileSearch size={20} />
              <span>Preview Import</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default DataUploader;