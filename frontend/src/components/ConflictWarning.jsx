import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import './ConflictWarning.css';

/**
 * ConflictWarning Component
 *
 * Displays a warning when optimistic locking detects a concurrent modification conflict.
 * This occurs when a user attempts to save changes to a resource that has been modified
 * by another user since it was loaded.
 *
 * @param {Object} props
 * @param {Object} props.conflict - Conflict details from the API (409 response)
 * @param {Function} props.onReload - Callback to reload the data
 * @param {Function} props.onDismiss - Callback to dismiss the warning
 */
const ConflictWarning = ({ conflict, onReload, onDismiss }) => {
  if (!conflict) return null;

  const {
    message = 'This item was modified by another user.',
    last_modified_by,
    last_modified_at,
    current_version
  } = conflict;

  const formatDate = (dateString) => {
    if (!dateString) return 'recently';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

      return date.toLocaleString();
    } catch (e) {
      return 'recently';
    }
  };

  return (
    <div className="conflict-warning-overlay">
      <div className="conflict-warning-dialog">
        <div className="conflict-warning-header">
          <div className="conflict-warning-icon">
            <AlertTriangle size={32} />
          </div>
          <h3 className="conflict-warning-title">Conflict Detected</h3>
          <button
            className="conflict-warning-close"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <X size={20} />
          </button>
        </div>

        <div className="conflict-warning-body">
          <p className="conflict-warning-message">{message}</p>

          {last_modified_by && (
            <div className="conflict-warning-details">
              <p>
                <strong>Modified by:</strong> {last_modified_by}
              </p>
              {last_modified_at && (
                <p>
                  <strong>Modified:</strong> {formatDate(last_modified_at)}
                </p>
              )}
              {current_version !== undefined && (
                <p>
                  <strong>Current version:</strong> {current_version}
                </p>
              )}
            </div>
          )}

          <div className="conflict-warning-explanation">
            <p>
              To resolve this conflict, you need to reload the latest version of this item.
              Any unsaved changes you made will be lost.
            </p>
          </div>
        </div>

        <div className="conflict-warning-footer">
          <button
            className="conflict-warning-button conflict-warning-button-secondary"
            onClick={onDismiss}
          >
            Cancel
          </button>
          <button
            className="conflict-warning-button conflict-warning-button-primary"
            onClick={onReload}
          >
            <RefreshCw size={16} />
            Reload Latest Version
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictWarning;
