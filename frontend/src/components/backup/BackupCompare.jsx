import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Table, Badge, Spinner, Accordion } from 'react-bootstrap';
import {
  FaSearch, FaDatabase, FaChartBar, FaSyncAlt, FaCode
} from 'react-icons/fa';
import backupService from '../../services/backupService';
import './BackupCompare.css';

/**
 * Compare two backups side-by-side
 * Shows differences in schema, data size, table counts, and versions
 */
const BackupCompare = ({ show, onHide, backups }) => {
  const [backup1Id, setBackup1Id] = useState('');
  const [backup2Id, setBackup2Id] = useState('');
  const [backup1, setBackup1] = useState(null);
  const [backup2, setBackup2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBackups = async () => {
    if (!backup1Id || !backup2Id) return;

    try {
      setLoading(true);
      setError(null);
      const [b1, b2] = await Promise.all([
        backupService.getBackup(backup1Id),
        backupService.getBackup(backup2Id)
      ]);
      setBackup1(b1);
      setBackup2(b2);
    } catch (err) {
      console.error('Error loading backups:', err);
      setError('Failed to load backups: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (backup1Id && backup2Id) {
      loadBackups();
    }
  }, [backup1Id, backup2Id]);

  const compareVersions = () => {
    if (!backup1 || !backup2) return null;

    const differences = [];

    if (backup1.django_version !== backup2.django_version) {
      differences.push({
        field: 'Django Version',
        backup1: backup1.django_version,
        backup2: backup2.django_version
      });
    }

    if (backup1.python_version !== backup2.python_version) {
      differences.push({
        field: 'Python Version',
        backup1: backup1.python_version,
        backup2: backup2.python_version
      });
    }

    if (backup1.postgres_version !== backup2.postgres_version) {
      differences.push({
        field: 'PostgreSQL Version',
        backup1: backup1.postgres_version,
        backup2: backup2.postgres_version
      });
    }

    if (backup1.app_version !== backup2.app_version) {
      differences.push({
        field: 'App Version',
        backup1: backup1.app_version || 'N/A',
        backup2: backup2.app_version || 'N/A'
      });
    }

    return differences;
  };

  const compareSizes = () => {
    if (!backup1 || !backup2) return null;

    const size1 = backup1.file_size || 0;
    const size2 = backup2.file_size || 0;
    const diff = size2 - size1;
    const percentChange = size1 > 0 ? ((diff / size1) * 100).toFixed(2) : 0;

    return {
      backup1Size: size1,
      backup2Size: size2,
      difference: diff,
      percentChange: parseFloat(percentChange)
    };
  };

  const compareMigrations = () => {
    if (!backup1 || !backup2) return null;

    const migs1 = backup1.migration_state || {};
    const migs2 = backup2.migration_state || {};
    const allApps = new Set([...Object.keys(migs1), ...Object.keys(migs2)]);

    return Array.from(allApps).map(app => {
      const m1 = migs1[app] || [];
      const m2 = migs2[app] || [];

      return {
        app,
        backup1Count: m1.length,
        backup2Count: m2.length,
        backup1Latest: m1[m1.length - 1] || 'None',
        backup2Latest: m2[m2.length - 1] || 'None',
        isDifferent: JSON.stringify(m1) !== JSON.stringify(m2)
      };
    });
  };

  const compareTableCounts = () => {
    if (!backup1 || !backup2) return null;

    const tables1 = backup1.table_counts || {};
    const tables2 = backup2.table_counts || {};
    const allTables = new Set([...Object.keys(tables1), ...Object.keys(tables2)]);

    return Array.from(allTables)
      .map(table => {
        const count1 = tables1[table] || 0;
        const count2 = tables2[table] || 0;
        const diff = count2 - count1;

        return {
          table,
          backup1Count: count1,
          backup2Count: count2,
          difference: diff,
          percentChange: count1 > 0 ? ((diff / count1) * 100).toFixed(2) : 0
        };
      })
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
  };

  const versionDiffs = compareVersions();
  const sizeDiff = compareSizes();
  const migrationDiffs = compareMigrations();
  const tableDiffs = compareTableCounts();

  return (
    <Modal show={show} onHide={onHide} size="xl" className="backup-compare-modal">
      <Modal.Header closeButton>
        <Modal.Title><FaSearch className="me-2" />Compare Backups</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Backup Selection */}
        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <Form.Label>First Backup</Form.Label>
            <Form.Select
              value={backup1Id}
              onChange={(e) => setBackup1Id(e.target.value)}
            >
              <option value="">Select backup...</option>
              {backups.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({backupService.formatDate(b.created_at)})
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-md-6">
            <Form.Label>Second Backup</Form.Label>
            <Form.Select
              value={backup2Id}
              onChange={(e) => setBackup2Id(e.target.value)}
            >
              <option value="">Select backup...</option>
              {backups.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({backupService.formatDate(b.created_at)})
                </option>
              ))}
            </Form.Select>
          </div>
        </div>

        {error && <div className="backup-compare-error">{error}</div>}

        {loading && (
          <div className="backup-compare-loading">
            <Spinner animation="border" />
            <p>Loading backup details...</p>
          </div>
        )}

        {!loading && backup1 && backup2 && (
          <>
            {/* Basic Info Comparison */}
            <div className="backup-compare-info-alert">
              <strong>Comparing:</strong>
              <div className="row mt-2">
                <div className="col-md-6">
                  <div><FaDatabase className="backup-info-icon" /><span className="backup-info-name">{backup1.name}</span></div>
                  <small className="backup-info-date">{backupService.formatDate(backup1.created_at)}</small>
                </div>
                <div className="col-md-6">
                  <div><FaDatabase className="backup-info-icon" /><span className="backup-info-name">{backup2.name}</span></div>
                  <small className="backup-info-date">{backupService.formatDate(backup2.created_at)}</small>
                </div>
              </div>
            </div>

            {/* Size Comparison */}
            {sizeDiff && (
              <div className={`backup-compare-size-alert ${sizeDiff.percentChange > 0 ? 'size-increase' : 'size-decrease'}`}>
                <FaChartBar className="me-2" />
                <strong>Size Comparison</strong>
                <div className="row mt-2">
                  <div className="col-md-4">
                    <small className="comparison-grid-label">First Backup:</small>
                    <div className="comparison-grid-value">{backupService.formatSize(sizeDiff.backup1Size)}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="comparison-grid-label">Second Backup:</small>
                    <div className="comparison-grid-value">{backupService.formatSize(sizeDiff.backup2Size)}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="comparison-grid-label">Difference:</small>
                    <div className="comparison-grid-value">
                      {sizeDiff.difference > 0 ? '+' : ''}
                      {backupService.formatSize(Math.abs(sizeDiff.difference))}
                      {' '}({sizeDiff.percentChange > 0 ? '+' : ''}{sizeDiff.percentChange}%)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Version Differences */}
            {versionDiffs && versionDiffs.length > 0 && (
              <div className="mb-4">
                <h6 className="backup-compare-section-header"><FaCode />Version Differences</h6>
                <Table bordered size="sm" className="backup-compare-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>First Backup</th>
                      <th>Second Backup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionDiffs.map((diff, idx) => (
                      <tr key={idx}>
                        <td><strong>{diff.field}</strong></td>
                        <td>{diff.backup1}</td>
                        <td>
                          {diff.backup2}
                          {diff.backup1 !== diff.backup2 && (
                            <span className="backup-compare-badge badge-warning ms-2">Changed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}

            {/* Migration Differences */}
            {migrationDiffs && (
              <div className="mb-4">
                <h6 className="backup-compare-section-header"><FaSyncAlt />Migration State Comparison</h6>
                <Accordion className="backup-compare-accordion">
                  {migrationDiffs.map((diff, idx) => (
                    <Accordion.Item eventKey={idx.toString()} key={diff.app}>
                      <Accordion.Header>
                        <div className="migration-header-content">
                          <strong>{diff.app}</strong>
                          {diff.isDifferent && (
                            <span className="backup-compare-badge badge-warning">Different</span>
                          )}
                          {!diff.isDifferent && (
                            <span className="backup-compare-badge badge-success">Same</span>
                          )}
                          <span className="migration-count">
                            {diff.backup1Count} → {diff.backup2Count} migrations
                          </span>
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <div className="row">
                          <div className="col-md-6">
                            <div className="migration-detail-label">First Backup</div>
                            <div className="migration-detail-value">{diff.backup1Count} migrations</div>
                            <small className="migration-latest-code">
                              Latest: {diff.backup1Latest}
                            </small>
                          </div>
                          <div className="col-md-6">
                            <div className="migration-detail-label">Second Backup</div>
                            <div className="migration-detail-value">{diff.backup2Count} migrations</div>
                            <small className="migration-latest-code">
                              Latest: {diff.backup2Latest}
                            </small>
                          </div>
                        </div>
                      </Accordion.Body>
                    </Accordion.Item>
                  ))}
                </Accordion>
              </div>
            )}

            {/* Table Count Differences */}
            {tableDiffs && tableDiffs.length > 0 && (
              <div className="mb-4">
                <h6 className="backup-compare-section-header"><FaChartBar />Table Row Count Changes</h6>
                <div className="backup-compare-table-scroll">
                  <Table bordered size="sm" hover className="backup-compare-table">
                    <thead className="backup-compare-table-sticky-header">
                      <tr>
                        <th>Table</th>
                        <th>First Backup</th>
                        <th>Second Backup</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableDiffs.map((diff, idx) => (
                        <tr key={idx}>
                          <td><code>{diff.table}</code></td>
                          <td>{diff.backup1Count.toLocaleString()}</td>
                          <td>{diff.backup2Count.toLocaleString()}</td>
                          <td>
                            {diff.difference !== 0 && (
                              <span className={diff.difference > 0 ? 'change-positive' : 'change-negative'}>
                                {diff.difference > 0 ? '+' : ''}
                                {diff.difference.toLocaleString()}
                                {' '}({diff.percentChange > 0 ? '+' : ''}{diff.percentChange}%)
                              </span>
                            )}
                            {diff.difference === 0 && (
                              <span className="backup-compare-badge badge-secondary">No change</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && (!backup1Id || !backup2Id) && (
          <div className="backup-compare-select-info">
            Select two backups to compare their details
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default BackupCompare;
