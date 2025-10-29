import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Badge, InputGroup } from 'react-bootstrap';
import {
  FaCalendarAlt, FaClock, FaDatabase, FaLightbulb
} from 'react-icons/fa';
import backupService from '../../services/backupService';
import '../../styles/backup.css';

/**
 * Backup scheduling configuration component
 * Configure automatic backups with time selection
 */
const BackupScheduler = ({ onSave }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    auto_backup_enabled: false,
    auto_backup_frequency: 'daily',
    auto_backup_hour: 2,
    auto_backup_include_media: false,
    retention_days: 30,
    max_backups: 10
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await backupService.getConfig();
      setConfig(data);
      setFormData({
        auto_backup_enabled: data.auto_backup_enabled,
        auto_backup_frequency: data.auto_backup_frequency || 'daily',
        auto_backup_hour: data.auto_backup_hour,
        auto_backup_include_media: data.auto_backup_include_media,
        retention_days: data.retention_days,
        max_backups: data.max_backups
      });
      setError(null);
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await backupService.updateConfig(formData);
      await loadConfig();

      setSuccess('Schedule configuration saved successfully!');

      // Call onSave callback if provided (to close modal and refresh parent)
      if (onSave) {
        setTimeout(() => {
          onSave();
        }, 1000); // Give user time to see success message
      } else {
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Generate time options
  const timeOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, '0')}:00 (${i === 0 ? '12' : i > 12 ? i - 12 : i} ${i >= 12 ? 'PM' : 'AM'})`
  }));

  // Calculate next backup time
  const getNextBackupTime = () => {
    if (!formData.auto_backup_enabled) return null;

    const now = new Date();
    const next = new Date();

    if (formData.auto_backup_frequency === 'hourly') {
      // Next hour
      next.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      // Daily at configured hour
      next.setHours(formData.auto_backup_hour, 0, 0, 0);
      // If the time has passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  };

  const nextBackup = getNextBackupTime();

  if (loading) {
    return (
      <Card>
        <Card.Body className="text-center py-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading schedule configuration...</p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <Card className="backup-scheduler-card">
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0"><FaCalendarAlt className="me-2" />Backup Schedule Configuration</h6>
          {formData.auto_backup_enabled && (
            <span className="backup-scheduler-badge badge-success">Enabled</span>
          )}
          {!formData.auto_backup_enabled && (
            <span className="backup-scheduler-badge badge-secondary">Disabled</span>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {error && (
          <div className="backup-scheduler-error-alert">
            <button className="backup-scheduler-alert-close" onClick={() => setError(null)}>×</button>
            {error}
          </div>
        )}

        {success && (
          <div className="backup-scheduler-success-alert">
            <button className="backup-scheduler-alert-close" onClick={() => setSuccess(null)}>×</button>
            {success}
          </div>
        )}

        {/* Enable/Disable Schedule */}
        <div
          className="mb-4 p-3 rounded"
          style={{
            backgroundColor: 'var(--secondary-bg)',
            border: '1px solid var(--table-border)'
          }}
        >
          <Form.Check
            type="switch"
            id="auto-backup-enabled"
            label={
              <span>
                <strong>Enable Automatic Scheduled Backups</strong>
                <div className="small" style={{ color: 'var(--muted-text)' }}>
                  Automatically create backups on a scheduled basis
                </div>
              </span>
            }
            checked={formData.auto_backup_enabled}
            onChange={(e) => handleChange('auto_backup_enabled', e.target.checked)}
          />
        </div>

        {/* Schedule Configuration */}
        {formData.auto_backup_enabled && (
          <>
            <div className="mb-4">
              <Form.Label style={{ color: 'var(--primary-text)' }}>
                <FaClock className="me-2" />
                <strong>Backup Frequency</strong>
              </Form.Label>
              <Form.Select
                value={formData.auto_backup_frequency}
                onChange={(e) => handleChange('auto_backup_frequency', e.target.value)}
                style={{
                  backgroundColor: 'var(--form-input-bg)',
                  color: 'var(--form-input-text)',
                  borderColor: 'var(--form-input-border)'
                }}
              >
                <option value="hourly">Hourly - Every hour</option>
                <option value="daily">Daily - Once per day</option>
              </Form.Select>
              <Form.Text style={{ color: 'var(--muted-text)' }}>
                Choose how often automatic backups should run
              </Form.Text>
            </div>

            {formData.auto_backup_frequency === 'daily' && (
              <div className="mb-4">
                <Form.Label style={{ color: 'var(--primary-text)' }}>
                  <strong>Daily Backup Time</strong>
                </Form.Label>
                <Form.Select
                  value={formData.auto_backup_hour}
                  onChange={(e) => handleChange('auto_backup_hour', parseInt(e.target.value))}
                  style={{
                    backgroundColor: 'var(--form-input-bg)',
                    color: 'var(--form-input-text)',
                    borderColor: 'var(--form-input-border)'
                  }}
                >
                  {timeOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text style={{ color: 'var(--muted-text)' }}>
                  Server time (local to the server). Daily backups will run at this time.
                </Form.Text>
              </div>
            )}

            {formData.auto_backup_frequency === 'hourly' && (
              <div className="mb-4">
                <div className="backup-scheduler-info-alert">
                  <strong>Hourly Backups:</strong> A backup will be created at the top of every hour (e.g., 1:00, 2:00, 3:00, etc.)
                </div>
              </div>
            )}

            {nextBackup && (
              <div className="backup-scheduler-info-alert mb-4">
                <FaCalendarAlt className="me-2" />
                <strong>Next Scheduled Backup ({formData.auto_backup_frequency === 'hourly' ? 'Hourly' : 'Daily'}):</strong>
                <div className="mt-1">
                  {nextBackup.toLocaleString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <small className="backup-scheduler-muted-text">
                  {formData.auto_backup_frequency === 'hourly' ? (
                    `(${Math.ceil((nextBackup - new Date()) / (1000 * 60))} minutes from now)`
                  ) : (
                    `(${Math.ceil((nextBackup - new Date()) / (1000 * 60 * 60))} hours from now)`
                  )}
                </small>
              </div>
            )}

            <div className="mb-4">
              <Form.Check
                type="checkbox"
                id="auto-backup-include-media"
                label={
                  <span>
                    <strong>Include Media Files</strong>
                    <div className="small" style={{ color: 'var(--muted-text)' }}>
                      Include uploaded media files in automatic backups (increases backup size)
                    </div>
                  </span>
                }
                checked={formData.auto_backup_include_media}
                onChange={(e) => handleChange('auto_backup_include_media', e.target.checked)}
              />
            </div>
          </>
        )}

        <hr />

        {/* Retention Policy */}
        <h6 className="mb-3" style={{ color: 'var(--primary-text)' }}><FaDatabase className="me-2" />Retention Policy</h6>

        <div className="mb-3">
          <Form.Label style={{ color: 'var(--primary-text)' }}>
            <strong>Maximum Backups to Retain</strong>
          </Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              min="0"
              value={formData.max_backups}
              onChange={(e) => handleChange('max_backups', parseInt(e.target.value))}
              style={{
                backgroundColor: 'var(--form-input-bg)',
                color: 'var(--form-input-text)',
                borderColor: 'var(--form-input-border)'
              }}
            />
            <InputGroup.Text style={{
              backgroundColor: 'var(--secondary-bg)',
              color: 'var(--primary-text)',
              borderColor: 'var(--form-input-border)'
            }}>backups</InputGroup.Text>
          </InputGroup>
          <Form.Text style={{ color: 'var(--muted-text)' }}>
            Keep only the N most recent backups. Set to 0 for unlimited.
            {formData.max_backups > 0 && ` Older backups will be automatically deleted.`}
          </Form.Text>
        </div>

        <div className="mb-4">
          <Form.Label style={{ color: 'var(--primary-text)' }}>
            <strong>Retention Period</strong>
          </Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              min="0"
              value={formData.retention_days}
              onChange={(e) => handleChange('retention_days', parseInt(e.target.value))}
              style={{
                backgroundColor: 'var(--form-input-bg)',
                color: 'var(--form-input-text)',
                borderColor: 'var(--form-input-border)'
              }}
            />
            <InputGroup.Text style={{
              backgroundColor: 'var(--secondary-bg)',
              color: 'var(--primary-text)',
              borderColor: 'var(--form-input-border)'
            }}>days</InputGroup.Text>
          </InputGroup>
          <Form.Text style={{ color: 'var(--muted-text)' }}>
            Automatically delete backups older than this many days. Set to 0 to keep all.
            {formData.retention_days > 0 && ` Backups older than ${formData.retention_days} days will be deleted.`}
          </Form.Text>
        </div>

        {/* Retention Policy Summary */}
        <div className="backup-scheduler-retention-alert">
          <strong>⚠️ Retention Policy:</strong>
          <div className="mt-2">
            {formData.max_backups === 0 && formData.retention_days === 0 && (
              <p className="mb-0">
                All backups will be kept indefinitely. Make sure you have adequate disk space.
              </p>
            )}
            {formData.max_backups > 0 && formData.retention_days > 0 && (
              <p className="mb-0">
                Backups will be deleted if they exceed {formData.max_backups} total backups OR
                are older than {formData.retention_days} days (whichever comes first).
              </p>
            )}
            {formData.max_backups > 0 && formData.retention_days === 0 && (
              <p className="mb-0">
                Only the {formData.max_backups} most recent backups will be kept.
              </p>
            )}
            {formData.max_backups === 0 && formData.retention_days > 0 && (
              <p className="mb-0">
                Backups older than {formData.retention_days} days will be automatically deleted.
              </p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="d-flex gap-2">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              'Save Schedule Configuration'
            )}
          </Button>

          <Button
            variant="outline-secondary"
            onClick={loadConfig}
            disabled={saving}
          >
            Reset
          </Button>
        </div>

        {/* Help Text */}
        <div
          className="mt-4 p-3 rounded"
          style={{
            backgroundColor: 'var(--secondary-bg)',
            border: '1px solid var(--table-border)'
          }}
        >
          <small style={{ color: 'var(--muted-text)' }}>
            <FaLightbulb className="me-2" />
            <strong>Tips:</strong>
            <ul className="mb-0 mt-2">
              <li>Schedule backups during low-traffic hours (e.g., 2-4 AM)</li>
              <li>Consider excluding media files from daily backups to save space</li>
              <li>Set appropriate retention policies based on your disk space and compliance requirements</li>
              <li>Monitor backup logs to ensure scheduled backups are running successfully</li>
              <li>Keep at least 7-14 days of backups for disaster recovery</li>
            </ul>
          </small>
        </div>
      </Card.Body>
    </Card>
  );
};

export default BackupScheduler;
