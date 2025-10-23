/**
 * Centralized API service for backup and restore operations
 */
import axios from 'axios';

const API_BASE = '/api/backup';

class BackupService {
  /**
   * List all backups with optional filtering
   */
  async listBackups(params = {}) {
    const response = await axios.get(`${API_BASE}/backups/`, { params });
    return response.data;
  }

  /**
   * Get detailed information about a specific backup
   */
  async getBackup(backupId) {
    const response = await axios.get(`${API_BASE}/backups/${backupId}/`);
    return response.data;
  }

  /**
   * Create a new backup
   */
  async createBackup(data) {
    const response = await axios.post(`${API_BASE}/backups/create/`, data);
    return response.data;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId) {
    const response = await axios.delete(`${API_BASE}/backups/${backupId}/delete/`);
    return response.data;
  }

  /**
   * Download backup file
   */
  downloadBackup(backupId) {
    window.open(`${API_BASE}/backups/${backupId}/download/`, '_blank');
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId, options = {}) {
    const response = await axios.post(`${API_BASE}/backups/${backupId}/restore/`, options);
    return response.data;
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    const response = await axios.post(`${API_BASE}/backups/${backupId}/verify/`);
    return response.data;
  }

  /**
   * Get backup logs
   */
  async getBackupLogs(backupId, limit = 100) {
    const response = await axios.get(`${API_BASE}/backups/${backupId}/logs/`, {
      params: { limit }
    });
    return response.data;
  }

  /**
   * List all restore operations
   */
  async listRestores(params = {}) {
    const response = await axios.get(`${API_BASE}/restores/`, { params });
    return response.data;
  }

  /**
   * Get detailed information about a restore operation
   */
  async getRestore(restoreId) {
    const response = await axios.get(`${API_BASE}/restores/${restoreId}/`);
    return response.data;
  }

  /**
   * Get backup configuration
   */
  async getConfig() {
    const response = await axios.get(`${API_BASE}/config/`);
    return response.data;
  }

  /**
   * Update backup configuration
   */
  async updateConfig(config) {
    const response = await axios.post(`${API_BASE}/config/`, config);
    return response.data;
  }

  /**
   * Get Celery task status
   */
  async getTaskStatus(taskId) {
    const response = await axios.get(`${API_BASE}/tasks/${taskId}/`);
    return response.data;
  }

  /**
   * Poll backup status until completion
   */
  async pollBackupStatus(backupId, callback, interval = 2000) {
    const pollInterval = setInterval(async () => {
      try {
        const backup = await this.getBackup(backupId);
        callback(backup);

        // Stop polling if completed, failed, or verified
        if (['completed', 'failed', 'verified'].includes(backup.status)) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling backup status:', error);
        clearInterval(pollInterval);
      }
    }, interval);

    return pollInterval;
  }

  /**
   * Poll restore status until completion
   */
  async pollRestoreStatus(restoreId, callback, interval = 2000) {
    const pollInterval = setInterval(async () => {
      try {
        const restore = await this.getRestore(restoreId);
        callback(restore);

        // Stop polling if completed, failed, or rolled back
        if (['completed', 'failed', 'rolled_back'].includes(restore.status)) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling restore status:', error);
        clearInterval(pollInterval);
      }
    }, interval);

    return pollInterval;
  }

  /**
   * Format file size in human-readable format
   */
  formatSize(bytes) {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  }

  /**
   * Format date in human-readable format
   */
  formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }

  /**
   * Calculate duration in human-readable format
   */
  formatDuration(duration) {
    if (!duration) return 'N/A';

    // If duration is a string like "0:05:23.123456", parse it
    if (typeof duration === 'string') {
      const parts = duration.split(':');
      if (parts.length === 3) {
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        const seconds = parseFloat(parts[2]);

        if (hours > 0) {
          return `${hours}h ${minutes}m ${Math.floor(seconds)}s`;
        } else if (minutes > 0) {
          return `${minutes}m ${Math.floor(seconds)}s`;
        } else {
          return `${Math.floor(seconds)}s`;
        }
      }
    }

    return duration;
  }

  /**
   * Get status badge variant for Bootstrap
   */
  getStatusVariant(status) {
    const variants = {
      'pending': 'secondary',
      'in_progress': 'primary',
      'completed': 'success',
      'failed': 'danger',
      'verifying': 'info',
      'verified': 'success',
      'validating': 'info',
      'pre_backup': 'warning',
      'restoring': 'primary',
      'migrating': 'warning',
      'rolled_back': 'warning'
    };
    return variants[status] || 'secondary';
  }

  /**
   * Get status label
   */
  getStatusLabel(status) {
    const labels = {
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'failed': 'Failed',
      'verifying': 'Verifying',
      'verified': 'Verified',
      'validating': 'Validating',
      'pre_backup': 'Creating Safety Backup',
      'restoring': 'Restoring',
      'migrating': 'Running Migrations',
      'rolled_back': 'Rolled Back'
    };
    return labels[status] || status;
  }

  /**
   * Calculate backup statistics
   */
  calculateStats(backups) {
    const stats = {
      total: backups.length,
      completed: 0,
      failed: 0,
      inProgress: 0,
      totalSize: 0,
      withMedia: 0
    };

    backups.forEach(backup => {
      if (backup.status === 'completed' || backup.status === 'verified') {
        stats.completed++;
      } else if (backup.status === 'failed') {
        stats.failed++;
      } else if (backup.status === 'in_progress') {
        stats.inProgress++;
      }

      if (backup.file_size) {
        stats.totalSize += backup.file_size;
      }

      if (backup.includes_media) {
        stats.withMedia++;
      }
    });

    return stats;
  }

  /**
   * Export backups list to CSV
   */
  exportToCSV(backups) {
    const headers = ['Name', 'Status', 'Created', 'Size (MB)', 'Django Version', 'App Version', 'Includes Media'];
    const rows = backups.map(backup => [
      backup.name,
      backup.status,
      this.formatDate(backup.created_at),
      backup.size_mb || '0',
      backup.django_version || 'N/A',
      backup.app_version || 'N/A',
      backup.includes_media ? 'Yes' : 'No'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `backups_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

const backupServiceInstance = new BackupService();
export default backupServiceInstance;
