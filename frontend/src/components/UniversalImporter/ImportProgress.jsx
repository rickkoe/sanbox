import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  FileText,
  ArrowRight,
  RefreshCw,
  Home,
  SquareTerminal,
  Activity,
  Zap,
  AlertTriangle
} from 'lucide-react';
import './styles/ImportProgress.css';

const ImportProgress = ({
  importStatus,
  importProgress,
  onViewLogs,
  onViewFabrics,
  onImportMore,
  onTryAgain,
  theme
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  // Helper function to safely render values that might be objects
  const safeRender = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') {
      // If it has a message property, use that
      if (value.message !== undefined) return safeRender(value.message, fallback);
      // If it has a total property (for stats), use that
      if (value.total !== undefined) return safeRender(value.total, fallback);
      // If it has a current property (for progress), use that
      if (value.current !== undefined) return safeRender(value.current, fallback);
      // Otherwise stringify it
      return JSON.stringify(value);
    }
    return fallback;
  };

  // Animate progress bar
  useEffect(() => {
    // Force progress to 100 when completed
    if (importStatus === 'COMPLETED') {
      setAnimatedProgress(100);
    } else if (importProgress?.progress) {
      const timer = setTimeout(() => {
        // Handle both number and object formats for progress
        const progressValue = typeof importProgress.progress === 'number'
          ? importProgress.progress
          : (importProgress.progress?.current && importProgress.progress?.total
              ? Math.round((importProgress.progress.current / importProgress.progress.total) * 100)
              : 0);
        setAnimatedProgress(progressValue);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [importProgress, importStatus]);

  // Show confetti on success
  useEffect(() => {
    console.log('Confetti check:', {
      importStatus,
      progressStatus: importProgress?.status,
      condition: importStatus === 'COMPLETED' && importProgress?.status === 'success'
    });

    if (importStatus === 'COMPLETED' && importProgress?.status === 'success') {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [importStatus, importProgress]);

  // Get status configuration
  const getStatusConfig = () => {
    switch (importStatus) {
      case 'PENDING':
        return {
          icon: Clock,
          color: 'warning',
          title: 'Preparing Import',
          description: 'Initializing import process...'
        };
      case 'RUNNING':
        return {
          icon: Loader,
          color: 'primary',
          title: 'Import in Progress',
          description: safeRender(importProgress?.message, 'Processing your data...')
        };
      case 'COMPLETED':
        return importProgress?.status === 'success' ? {
          icon: CheckCircle,
          color: 'success',
          title: 'Import Successful!',
          description: 'Your data has been imported successfully'
        } : {
          icon: XCircle,
          color: 'error',
          title: 'Import Failed',
          description: safeRender(importProgress?.error, 'An error occurred during import')
        };
      case 'FAILED':
        return {
          icon: XCircle,
          color: 'error',
          title: 'Import Failed',
          description: safeRender(importProgress?.error, 'The import process encountered an error')
        };
      default:
        return {
          icon: Activity,
          color: 'info',
          title: 'Unknown Status',
          description: 'Please check the logs for more information'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Parse import stats
  const stats = importProgress?.stats || {};

  // Debug rendering state
  console.log('ImportProgress rendering:', {
    importStatus,
    progressStatus: importProgress?.status,
    showingProgressBar: importStatus === 'RUNNING',
    showingSuccessStats: importStatus === 'COMPLETED' && importProgress?.status === 'success',
    showingSuccessButtons: importStatus === 'COMPLETED' && importProgress?.status === 'success',
    statusTitle: statusConfig.title,
    statusColor: statusConfig.color,
    importProgressFull: importProgress,
    stats: stats
  });

  return (
    <div className={`import-progress theme-${theme}`}>
      {/* Status Card */}
      <div className={`status-card color-${statusConfig.color}`}>
        <div className="status-icon-wrapper">
          <div className="status-icon-bg" />
          {importStatus === 'RUNNING' && <div className="status-icon-ring" />}
          <StatusIcon
            size={64}
            className={importStatus === 'RUNNING' ? 'spinning' : importStatus === 'COMPLETED' && importProgress?.status === 'success' ? 'success-bounce' : ''}
          />
        </div>

        <div className="status-content">
          <h2 className="status-title">{statusConfig.title}</h2>
          <p className="status-description">{statusConfig.description}</p>
        </div>
      </div>

      {/* Progress Bar (for running state) */}
      {importStatus === 'RUNNING' && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Processing</span>
            <span className="progress-percentage">{animatedProgress}%</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-bg" />
            <div
              className="progress-bar-fill"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
          {importProgress?.current_item && (
            <div className="progress-details">
              <Activity size={16} />
              <span>{safeRender(importProgress.current_item, 'Processing...')}</span>
            </div>
          )}
        </div>
      )}

      {/* Import Stats (for completed state) */}
      {importStatus === 'COMPLETED' && importProgress?.status === 'success' && (
        <div className="stats-section">
          <div className="stats-grid">
            {(stats.aliases_created !== undefined || stats.aliases !== undefined) && (
              <div className="stat-item">
                <div className="stat-icon">
                  <Zap size={20} />
                </div>
                <div className="stat-value">{stats.aliases_created || stats.aliases || 0}</div>
                <div className="stat-label">Aliases Imported</div>
              </div>
            )}
            {(stats.zones_created !== undefined || stats.zones !== undefined) && (
              <div className="stat-item">
                <div className="stat-icon">
                  <Activity size={20} />
                </div>
                <div className="stat-value">{stats.zones_created || stats.zones || 0}</div>
                <div className="stat-label">Zones Created</div>
              </div>
            )}
            {(stats.fabrics_created !== undefined || stats.fabrics_updated !== undefined || stats.fabrics !== undefined) && (
              <div className="stat-item">
                <div className="stat-icon">
                  <FileText size={20} />
                </div>
                <div className="stat-value">{stats.fabrics_created || stats.fabrics_updated || stats.fabrics || 0}</div>
                <div className="stat-label">Fabrics {stats.fabrics_created ? 'Created' : 'Updated'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Details (for failed state) */}
      {(importStatus === 'FAILED' || (importStatus === 'COMPLETED' && importProgress?.status === 'error')) && (
        <div className="error-section">
          <div className="error-header">
            <AlertTriangle size={20} />
            <span>Error Details</span>
          </div>
          <div className="error-content">
            <code>{safeRender(importProgress?.error, 'Unknown error occurred')}</code>
          </div>
          {importProgress?.details && (
            <div className="error-details">
              <pre>{JSON.stringify(importProgress.details, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-section">
        {importStatus === 'RUNNING' && (
          <button className="action-button secondary" onClick={onViewLogs}>
            <SquareTerminal size={18} />
            <span>View Logs</span>
          </button>
        )}

        {importStatus === 'COMPLETED' && importProgress?.status === 'success' && (
          <>
            <button className="action-button primary" onClick={onViewFabrics}>
              <ArrowRight size={18} />
              <span>View Fabrics</span>
            </button>
            <button className="action-button secondary" onClick={onImportMore}>
              <RefreshCw size={18} />
              <span>Import More Data</span>
            </button>
            <button className="action-button outline" onClick={onViewLogs}>
              <SquareTerminal size={18} />
              <span>View Logs</span>
            </button>
          </>
        )}

        {(importStatus === 'FAILED' || (importStatus === 'COMPLETED' && importProgress?.status === 'error')) && (
          <>
            <button className="action-button primary" onClick={onTryAgain}>
              <RefreshCw size={18} />
              <span>Try Again</span>
            </button>
            <button className="action-button secondary" onClick={onViewLogs}>
              <SquareTerminal size={18} />
              <span>View Error Logs</span>
            </button>
            <button className="action-button outline" onClick={onImportMore}>
              <Home size={18} />
              <span>Back to Start</span>
            </button>
          </>
        )}
      </div>

      {/* Timeline (optional enhancement) */}
      {importProgress?.timeline && importProgress.timeline.length > 0 && (
        <div className="timeline-section">
          <h3>Import Timeline</h3>
          <div className="timeline">
            {importProgress.timeline.map((event, index) => (
              <div key={index} className={`timeline-item ${event.status}`}>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <div className="timeline-time">{safeRender(event.time)}</div>
                  <div className="timeline-message">{safeRender(event.message)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportProgress;