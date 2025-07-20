"""
Import logging utilities
"""
from .models import ImportLog


class ImportLogger:
    """Helper class for logging import progress"""
    
    def __init__(self, import_record):
        self.import_record = import_record
    
    def log(self, message, level='INFO', details=None):
        """Add a log entry for this import"""
        try:
            ImportLog.objects.create(
                import_record=self.import_record,
                level=level,
                message=message,
                details=details
            )
        except Exception as e:
            # If logging fails, don't let it break the import
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to write import log: {e}. Original message: {message}")
    
    def debug(self, message, details=None):
        self.log(message, 'DEBUG', details)
    
    def info(self, message, details=None):
        self.log(message, 'INFO', details)
    
    def warning(self, message, details=None):
        self.log(message, 'WARNING', details)
    
    def error(self, message, details=None):
        self.log(message, 'ERROR', details)