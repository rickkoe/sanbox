import React from 'react';
import {
  CheckCircle,
  XCircle,
  Loader,
  FileText,
  RefreshCw
} from 'lucide-react';

const ImportProgress = ({
  importStatus,
  importProgress,
  onViewLogs,
  onViewFabrics, // Deprecated - keeping for backward compatibility
  onImportMore,
  onTryAgain,
  onNavigate // New: function to navigate to different pages
}) => {
  // Determine display status
  const isRunning = importStatus === 'RUNNING' || importStatus === 'PENDING';
  const isSuccess = importStatus === 'COMPLETED' || importProgress?.status === 'success';
  const isError = importStatus === 'FAILED' || importProgress?.status === 'error';

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (isSuccess) return 100;
    if (isError) return 0;
    if (importProgress?.progress) {
      if (typeof importProgress.progress === 'number') {
        return importProgress.progress;
      }
      if (importProgress.progress.current && importProgress.progress.total) {
        return (importProgress.progress.current / importProgress.progress.total) * 100;
      }
    }
    return 0;
  };

  const percentage = getProgressPercentage();

  // Get status message
  const getMessage = () => {
    if (isSuccess) {
      return 'Import completed successfully!';
    }
    if (isError) {
      return importProgress?.error || 'Import failed. Please try again.';
    }
    if (importProgress?.message) {
      return importProgress.message;
    }
    return 'Processing your data...';
  };

  return (
    <div className="import-progress">
      {/* Status Badge */}
      <div className={`progress-status-badge ${isSuccess ? 'success' : isError ? 'error' : 'running'}`}>
        {isRunning && <Loader size={18} className="spinning" />}
        {isSuccess && <CheckCircle size={18} />}
        {isError && <XCircle size={18} />}
        <span>
          {isSuccess ? 'Completed' : isError ? 'Failed' : 'Running'}
        </span>
      </div>

      {/* Progress Bar (only show when running) */}
      {isRunning && (
        <div className="import-progress-bar">
          <div
            className="import-progress-fill"
            style={{ width: `${percentage}%` }}
          >
            <div className="import-progress-shimmer"></div>
          </div>
        </div>
      )}

      {/* Message */}
      <div className="progress-message">{getMessage()}</div>

      {/* Success Stats */}
      {isSuccess && importProgress?.stats && (
        <div className="success-stats">
          {importProgress.stats.fabrics !== undefined && (
            <div className="success-stat">
              <div className="success-stat-value">{importProgress.stats.fabrics || 0}</div>
              <div className="success-stat-label">Fabrics</div>
            </div>
          )}
          {importProgress.stats.switches !== undefined && importProgress.stats.switches > 0 && (
            <div className="success-stat">
              <div className="success-stat-value">{importProgress.stats.switches}</div>
              <div className="success-stat-label">Switches</div>
            </div>
          )}
          {importProgress.stats.aliases !== undefined && (
            <div className="success-stat">
              <div className="success-stat-value">{importProgress.stats.aliases || 0}</div>
              <div className="success-stat-label">Aliases</div>
            </div>
          )}
          {importProgress.stats.zones !== undefined && (
            <div className="success-stat">
              <div className="success-stat-value">{importProgress.stats.zones || 0}</div>
              <div className="success-stat-label">Zones</div>
            </div>
          )}
          {(importProgress.stats.storage_systems_created !== undefined ||
            importProgress.stats.storage_systems_updated !== undefined) && (
            <div className="success-stat">
              <div className="success-stat-value">
                {(importProgress.stats.storage_systems_created || 0) +
                 (importProgress.stats.storage_systems_updated || 0)}
              </div>
              <div className="success-stat-label">Systems</div>
            </div>
          )}
          {(importProgress.stats.volumes_created !== undefined ||
            importProgress.stats.volumes_updated !== undefined) && (
            <div className="success-stat">
              <div className="success-stat-value">
                {(importProgress.stats.volumes_created || 0) +
                 (importProgress.stats.volumes_updated || 0)}
              </div>
              <div className="success-stat-label">Volumes</div>
            </div>
          )}
          {(importProgress.stats.hosts_created !== undefined ||
            importProgress.stats.hosts_updated !== undefined) && (
            <div className="success-stat">
              <div className="success-stat-value">
                {(importProgress.stats.hosts_created || 0) +
                 (importProgress.stats.hosts_updated || 0)}
              </div>
              <div className="success-stat-label">Hosts</div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="progress-actions">
        {isRunning && onViewLogs && (
          <button
            className="nav-button secondary"
            onClick={onViewLogs}
          >
            <FileText size={18} />
            View Logs
          </button>
        )}

        {isSuccess && (
          <>
            {/* Dynamic view buttons based on what was imported */}
            {onNavigate && importProgress?.stats && (
              <>
                {/* SAN entity buttons */}
                {importProgress.stats.fabrics > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/san/fabrics')}
                  >
                    <CheckCircle size={18} />
                    View Fabrics
                  </button>
                )}
                {importProgress.stats.switches > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/san/switches')}
                  >
                    <CheckCircle size={18} />
                    View Switches
                  </button>
                )}
                {importProgress.stats.aliases > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/san/aliases')}
                  >
                    <CheckCircle size={18} />
                    View Aliases
                  </button>
                )}
                {importProgress.stats.zones > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/san/zones')}
                  >
                    <CheckCircle size={18} />
                    View Zones
                  </button>
                )}

                {/* Storage entity buttons */}
                {((importProgress.stats.storage_systems_created || 0) +
                  (importProgress.stats.storage_systems_updated || 0)) > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/storage/systems')}
                  >
                    <CheckCircle size={18} />
                    View Storage Systems
                  </button>
                )}
                {((importProgress.stats.volumes_created || 0) +
                  (importProgress.stats.volumes_updated || 0)) > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/storage/volumes')}
                  >
                    <CheckCircle size={18} />
                    View Volumes
                  </button>
                )}
                {((importProgress.stats.hosts_created || 0) +
                  (importProgress.stats.hosts_updated || 0)) > 0 && (
                  <button
                    className="nav-button primary"
                    onClick={() => onNavigate('/storage/hosts')}
                  >
                    <CheckCircle size={18} />
                    View Hosts
                  </button>
                )}
              </>
            )}

            {/* Fallback to legacy onViewFabrics if no onNavigate provided */}
            {!onNavigate && onViewFabrics && (
              <button
                className="nav-button primary"
                onClick={onViewFabrics}
              >
                <CheckCircle size={18} />
                View Fabrics
              </button>
            )}

            {onImportMore && (
              <button
                className="nav-button secondary"
                onClick={onImportMore}
              >
                <RefreshCw size={18} />
                Import More
              </button>
            )}
          </>
        )}

        {isError && (
          <>
            {onTryAgain && (
              <button
                className="nav-button primary"
                onClick={onTryAgain}
              >
                <RefreshCw size={18} />
                Try Again
              </button>
            )}
            {onViewLogs && (
              <button
                className="nav-button secondary"
                onClick={onViewLogs}
              >
                <FileText size={18} />
                View Logs
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImportProgress;
