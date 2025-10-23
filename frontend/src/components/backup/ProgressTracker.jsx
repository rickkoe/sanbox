import React from 'react';
import { Card, ProgressBar, Badge, Alert } from 'react-bootstrap';
import {
  FaClock, FaCog, FaSearch, FaCheckCircle, FaTimesCircle,
  FaDatabase, FaUndo, FaSyncAlt, FaExclamationTriangle
} from 'react-icons/fa';
import backupService from '../../services/backupService';

/**
 * Real-time progress tracker for backup and restore operations
 * Shows current step, progress percentage, and estimated time
 */
const ProgressTracker = ({ operation, showDetails = true }) => {
  if (!operation) return null;

  const { status, started_at, completed_at, duration, error_message } = operation;

  // Calculate progress percentage based on status
  const getProgress = () => {
    const progressMap = {
      // Backup statuses
      'pending': 0,
      'in_progress': 50,
      'completed': 100,
      'verified': 100,
      'verifying': 90,
      'failed': 0,

      // Restore statuses
      'validating': 20,
      'pre_backup': 30,
      'restoring': 60,
      'migrating': 80,
      'rolled_back': 0
    };
    return progressMap[status] || 0;
  };

  // Get step description
  const getStepDescription = () => {
    const descriptions = {
      // Backup
      'pending': 'Waiting to start backup...',
      'in_progress': 'Creating database backup...',
      'verifying': 'Verifying backup integrity...',
      'verified': 'Backup verified successfully',
      'completed': 'Backup completed successfully',
      'failed': 'Backup failed',

      // Restore
      'validating': 'Validating backup file...',
      'pre_backup': 'Creating pre-restore safety backup...',
      'restoring': 'Restoring database...',
      'migrating': 'Running database migrations...',
      'rolled_back': 'Restore rolled back'
    };
    return descriptions[status] || status;
  };

  // Get step icon
  const getStepIcon = () => {
    const icons = {
      'pending': <FaClock />,
      'in_progress': <FaCog className="fa-spin" />,
      'verifying': <FaSearch />,
      'verified': <FaCheckCircle />,
      'completed': <FaCheckCircle />,
      'failed': <FaTimesCircle />,
      'validating': <FaSearch />,
      'pre_backup': <FaDatabase />,
      'restoring': <FaUndo />,
      'migrating': <FaSyncAlt className="fa-spin" />,
      'rolled_back': <FaUndo />
    };
    return icons[status] || <FaDatabase />;
  };

  const progress = getProgress();
  const variant = backupService.getStatusVariant(status);
  const isActive = ['in_progress', 'verifying', 'validating', 'pre_backup', 'restoring', 'migrating'].includes(status);
  const isComplete = ['completed', 'verified'].includes(status);
  const isFailed = ['failed', 'rolled_back'].includes(status);

  return (
    <Card className="mb-3">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex align-items-center">
            <span className="fs-4 me-2">{getStepIcon()}</span>
            <div>
              <h6 className="mb-0">{getStepDescription()}</h6>
              {showDetails && started_at && (
                <small className="text-muted">
                  Started: {backupService.formatDate(started_at)}
                  {completed_at && ` • Duration: ${backupService.formatDuration(duration)}`}
                </small>
              )}
            </div>
          </div>
          <Badge bg={variant}>{backupService.getStatusLabel(status)}</Badge>
        </div>

        {!isFailed && (
          <ProgressBar
            now={progress}
            variant={variant}
            animated={isActive}
            striped={isActive}
            label={isComplete ? '100%' : `${progress}%`}
          />
        )}

        {error_message && (
          <Alert variant="danger" className="mt-3 mb-0">
            <strong>Error:</strong> {error_message}
          </Alert>
        )}

        {showDetails && operation.migration_plan && (
          <div className="mt-3">
            <small className="text-muted">
              <strong>Migration Plan:</strong> {Object.keys(operation.migration_plan).length} migrations to run
            </small>
          </div>
        )}

        {showDetails && operation.compatibility_warnings && operation.compatibility_warnings.length > 0 && (
          <Alert variant="warning" className="mt-3 mb-0">
            <small>
              <FaExclamationTriangle className="me-2" />
              <strong>Compatibility Warnings:</strong>
              <ul className="mb-0 mt-1">
                {operation.compatibility_warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </small>
          </Alert>
        )}
      </Card.Body>
    </Card>
  );
};

export default ProgressTracker;
