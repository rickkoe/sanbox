import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Alert, Badge, InputGroup } from 'react-bootstrap';
import {
  FaCalendarAlt, FaClock, FaDatabase, FaLightbulb
} from 'react-icons/fa';
import backupService from '../../services/backupService';

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
    next.setHours(formData.auto_backup_hour, 0, 0, 0);

    // If the time has passed today, schedule for tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
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
    <Card>
      <Card.Header>
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="mb-0"><FaCalendarAlt className="me-2" />Backup Schedule Configuration</h6>
          {formData.auto_backup_enabled && (
            <Badge bg="success">Enabled</Badge>
          )}
          {!formData.auto_backup_enabled && (
            <Badge bg="secondary">Disabled</Badge>
          )}
        </div>
      </Card.Header>
      <Card.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Enable/Disable Schedule */}
        <div className="mb-4 p-3 bg-light rounded">
          <Form.Check
            type="switch"
            id="auto-backup-enabled"
            label={
              <span>
                <strong>Enable Automatic Scheduled Backups</strong>
                <div className="small text-muted">
                  Automatically create backups on a daily schedule
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
              <Form.Label>
                <FaClock className="me-2" />
                <strong>Backup Time</strong>
              </Form.Label>
              <Form.Select
                value={formData.auto_backup_hour}
                onChange={(e) => handleChange('auto_backup_hour', parseInt(e.target.value))}
              >
                {timeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                Server time (local to the server). Daily backups will run at this time.
              </Form.Text>
            </div>

            {nextBackup && (
              <Alert variant="info" className="mb-4">
                <FaCalendarAlt className="me-2" />
                <strong>Next Scheduled Backup:</strong>
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
                <small className="text-muted">
                  ({Math.ceil((nextBackup - new Date()) / (1000 * 60 * 60))} hours from now)
                </small>
              </Alert>
            )}

            <div className="mb-4">
              <Form.Check
                type="checkbox"
                id="auto-backup-include-media"
                label={
                  <span>
                    <strong>Include Media Files</strong>
                    <div className="small text-muted">
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
        <h6 className="mb-3"><FaDatabase className="me-2" />Retention Policy</h6>

        <div className="mb-3">
          <Form.Label>
            <strong>Maximum Backups to Retain</strong>
          </Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              min="0"
              value={formData.max_backups}
              onChange={(e) => handleChange('max_backups', parseInt(e.target.value))}
            />
            <InputGroup.Text>backups</InputGroup.Text>
          </InputGroup>
          <Form.Text className="text-muted">
            Keep only the N most recent backups. Set to 0 for unlimited.
            {formData.max_backups > 0 && ` Older backups will be automatically deleted.`}
          </Form.Text>
        </div>

        <div className="mb-4">
          <Form.Label>
            <strong>Retention Period</strong>
          </Form.Label>
          <InputGroup>
            <Form.Control
              type="number"
              min="0"
              value={formData.retention_days}
              onChange={(e) => handleChange('retention_days', parseInt(e.target.value))}
            />
            <InputGroup.Text>days</InputGroup.Text>
          </InputGroup>
          <Form.Text className="text-muted">
            Automatically delete backups older than this many days. Set to 0 to keep all.
            {formData.retention_days > 0 && ` Backups older than ${formData.retention_days} days will be deleted.`}
          </Form.Text>
        </div>

        {/* Retention Policy Summary */}
        <Alert variant="warning">
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
        </Alert>

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
        <div className="mt-4 p-3 bg-light rounded">
          <small className="text-muted">
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
