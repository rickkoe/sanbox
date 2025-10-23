import React from 'react';
import { Card, Alert, Badge, Table, Accordion } from 'react-bootstrap';
import {
  FaSyncAlt, FaCheckCircle, FaArrowUp, FaArrowDown, FaExclamationTriangle,
  FaMinus, FaInfoCircle, FaList, FaDatabase
} from 'react-icons/fa';

/**
 * Visual display of migration plan and schema compatibility
 * Shows forward/backward migrations and compatibility warnings
 */
const MigrationPlanView = ({ backup, currentMigrations, migrationPlan, compatibilityWarnings }) => {
  if (!backup || !backup.migration_state) {
    return null;
  }

  const backupMigrations = backup.migration_state || {};
  const current = currentMigrations || {};

  // Determine compatibility status
  const getCompatibilityStatus = (app) => {
    const backupMigs = backupMigrations[app] || [];
    const currentMigs = current[app] || [];

    if (!backupMigs.length && !currentMigs.length) return 'none';

    const backupLatest = backupMigs[backupMigs.length - 1];
    const currentLatest = currentMigs[currentMigs.length - 1];

    if (backupLatest === currentLatest) return 'exact';
    if (currentMigs.includes(backupLatest)) return 'forward'; // Backup is older, needs forward migration
    if (backupMigs.includes(currentLatest)) return 'backward'; // Backup is newer, needs backward migration

    return 'diverged';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'exact': <FaCheckCircle className="text-success" />,
      'forward': <FaArrowUp className="text-info" />,
      'backward': <FaArrowDown className="text-warning" />,
      'diverged': <FaExclamationTriangle className="text-danger" />,
      'none': <FaMinus className="text-secondary" />
    };
    return icons[status] || <FaInfoCircle />;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'exact': 'Exact Match',
      'forward': 'Needs Forward Migration',
      'backward': 'Needs Backward Migration',
      'diverged': 'Diverged Schema',
      'none': 'No Migrations'
    };
    return labels[status] || 'Unknown';
  };

  const getStatusVariant = (status) => {
    const variants = {
      'exact': 'success',
      'forward': 'info',
      'backward': 'warning',
      'diverged': 'danger',
      'none': 'secondary'
    };
    return variants[status] || 'secondary';
  };

  // Get all apps
  const allApps = new Set([...Object.keys(backupMigrations), ...Object.keys(current)]);
  const apps = Array.from(allApps).sort();

  // Calculate overall compatibility
  const appStatuses = apps.map(app => getCompatibilityStatus(app));
  const hasWarnings = appStatuses.some(s => ['backward', 'diverged'].includes(s));
  const hasForwardMigrations = appStatuses.some(s => s === 'forward');
  const isFullyCompatible = appStatuses.every(s => s === 'exact' || s === 'none');

  return (
    <Card className="mb-3">
      <Card.Header>
        <h6 className="mb-0"><FaSyncAlt className="me-2" />Schema Version & Migration Plan</h6>
      </Card.Header>
      <Card.Body>
        {/* Overall Status */}
        <Alert variant={isFullyCompatible ? 'success' : hasWarnings ? 'warning' : 'info'} className="mb-3">
          <div className="d-flex align-items-center">
            <span className="fs-4 me-2">
              {isFullyCompatible ? <FaCheckCircle /> : hasWarnings ? <FaExclamationTriangle /> : <FaInfoCircle />}
            </span>
            <div>
              <strong>
                {isFullyCompatible
                  ? 'Fully Compatible'
                  : hasWarnings
                  ? 'Compatibility Warnings'
                  : 'Migrations Required'}
              </strong>
              <div className="small mt-1">
                {isFullyCompatible && 'Backup schema matches current code perfectly'}
                {hasForwardMigrations && !hasWarnings && 'Forward migrations will be applied automatically'}
                {hasWarnings && 'Manual intervention may be required'}
              </div>
            </div>
          </div>
        </Alert>

        {/* Compatibility Warnings */}
        {compatibilityWarnings && compatibilityWarnings.length > 0 && (
          <Alert variant="warning" className="mb-3">
            <FaExclamationTriangle className="me-2" />
            <strong>Warnings:</strong>
            <ul className="mb-0 mt-2">
              {compatibilityWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        {/* Migration Plan Summary */}
        {migrationPlan && Object.keys(migrationPlan).length > 0 && (
          <Alert variant="info" className="mb-3">
            <FaList className="me-2" />
            <strong>Migration Plan:</strong>
            <div className="small mt-2">
              {Object.entries(migrationPlan).map(([app, migrations]) => (
                <div key={app} className="mb-1">
                  <strong>{app}:</strong> {migrations.length} migration(s) to run
                </div>
              ))}
            </div>
          </Alert>
        )}

        {/* App-by-App Breakdown */}
        <Accordion defaultActiveKey="0">
          {apps.map((app, index) => {
            const status = getCompatibilityStatus(app);
            const backupMigs = backupMigrations[app] || [];
            const currentMigs = current[app] || [];

            return (
              <Accordion.Item eventKey={index.toString()} key={app}>
                <Accordion.Header>
                  <div className="d-flex align-items-center w-100">
                    <span className="me-2">{getStatusIcon(status)}</span>
                    <strong className="me-2">{app}</strong>
                    <Badge bg={getStatusVariant(status)} className="me-auto">
                      {getStatusLabel(status)}
                    </Badge>
                    <small className="text-muted me-2">
                      Backup: {backupMigs.length} • Current: {currentMigs.length}
                    </small>
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  <div className="row">
                    {/* Backup Migrations */}
                    <div className="col-md-6">
                      <h6 className="small text-muted mb-2"><FaDatabase className="me-2" />Backup Migrations</h6>
                      {backupMigs.length > 0 ? (
                        <div className="small" style={{ fontFamily: 'monospace' }}>
                          {backupMigs.map((mig, idx) => (
                            <div key={idx} className="mb-1">
                              {idx + 1}. {mig}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <small className="text-muted">No migrations</small>
                      )}
                    </div>

                    {/* Current Migrations */}
                    <div className="col-md-6">
                      <h6 className="small text-muted mb-2"><FaSyncAlt className="me-2" />Current Code Migrations</h6>
                      {currentMigs.length > 0 ? (
                        <div className="small" style={{ fontFamily: 'monospace' }}>
                          {currentMigs.map((mig, idx) => {
                            const isNew = !backupMigs.includes(mig);
                            return (
                              <div
                                key={idx}
                                className="mb-1"
                                style={{
                                  color: isNew ? '#28a745' : 'inherit',
                                  fontWeight: isNew ? 'bold' : 'normal'
                                }}
                              >
                                {idx + 1}. {mig} {isNew && '(new)'}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <small className="text-muted">No migrations</small>
                      )}
                    </div>
                  </div>

                  {/* Action Needed */}
                  {status === 'backward' && (
                    <Alert variant="warning" className="mt-3 mb-0">
                      <small>
                        <FaExclamationTriangle className="me-1" />
                        <strong>Action Required:</strong> The backup contains migrations not
                        present in your current code. You may need to update your code or roll
                        back the backup's migrations manually.
                      </small>
                    </Alert>
                  )}

                  {status === 'forward' && migrationPlan && migrationPlan[app] && (
                    <Alert variant="info" className="mt-3 mb-0">
                      <small>
                        <FaInfoCircle className="me-1" />
                        <strong>Automatic Migration:</strong> These migrations will be applied
                        automatically after restore: {migrationPlan[app].join(', ')}
                      </small>
                    </Alert>
                  )}

                  {status === 'diverged' && (
                    <Alert variant="danger" className="mt-3 mb-0">
                      <small>
                        <FaExclamationTriangle className="me-1" />
                        <strong>Schema Divergence:</strong> The backup and current code have
                        diverged. This may indicate a complex migration history. Proceed with caution.
                      </small>
                    </Alert>
                  )}
                </Accordion.Body>
              </Accordion.Item>
            );
          })}
        </Accordion>

        {/* Legend */}
        <div className="mt-3 p-3 bg-light rounded">
          <small className="text-muted">
            <strong>Legend:</strong>
            <div className="mt-2">
              <div><FaCheckCircle className="text-success me-2" /><strong>Exact Match:</strong> No action needed</div>
              <div><FaArrowUp className="text-info me-2" /><strong>Forward Migration:</strong> Backup is older, migrations will run automatically</div>
              <div><FaArrowDown className="text-warning me-2" /><strong>Backward Migration:</strong> Backup is newer, manual intervention required</div>
              <div><FaExclamationTriangle className="text-danger me-2" /><strong>Diverged:</strong> Incompatible migration history</div>
            </div>
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default MigrationPlanView;
