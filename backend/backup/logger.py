"""
Logging utility for backup/restore operations
Similar to importer/logger.py but for backup operations
"""

from .models import BackupLog


class BackupLogger:
    """Logger for backup and restore operations"""

    def __init__(self, backup_record):
        self.backup_record = backup_record

    def _log(self, level, message, details=None):
        """Create a log entry"""
        BackupLog.objects.create(
            backup=self.backup_record,
            level=level,
            message=message,
            details=details
        )

    def debug(self, message, details=None):
        """Log debug message"""
        self._log('DEBUG', message, details)

    def info(self, message, details=None):
        """Log info message"""
        self._log('INFO', message, details)

    def warning(self, message, details=None):
        """Log warning message"""
        self._log('WARNING', message, details)

    def error(self, message, details=None):
        """Log error message"""
        self._log('ERROR', message, details)
