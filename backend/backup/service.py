"""
Backup and Restore Service
Handles database backup and restore operations using pg_dump and pg_restore
"""

import os
import subprocess
import hashlib
import json
import sys
import tarfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from django.conf import settings
from django.db import connection
from django.apps import apps
from django.core.management import call_command
from django.utils import timezone
from .models import BackupRecord, BackupConfiguration, RestoreRecord
from .logger import BackupLogger


class BackupService:
    """Service for creating and managing database backups"""

    def __init__(self, backup_record):
        self.backup_record = backup_record
        self.logger = BackupLogger(backup_record)
        self.config = BackupConfiguration.get_config()

    def create_backup(self, include_media=False):
        """
        Create a full database backup using pg_dump

        Args:
            include_media: Whether to include media files in the backup

        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        try:
            self.logger.info("Starting backup process")
            self.backup_record.status = 'in_progress'
            self.backup_record.started_at = timezone.now()
            self.backup_record.save()

            # Collect version information
            self._collect_version_info()

            # Collect schema information
            self._collect_schema_info()

            # Collect database statistics
            self._collect_database_stats()

            # Create backup directory if it doesn't exist
            backup_dir = Path(self.config.backup_directory)
            backup_dir.mkdir(parents=True, exist_ok=True)

            # Generate backup filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_filename = f"sanbox_backup_{timestamp}.dump"
            backup_path = backup_dir / backup_filename

            self.logger.info(f"Creating backup file: {backup_path}")

            # Create database dump using pg_dump
            success = self._create_pg_dump(backup_path)
            if not success:
                raise Exception("pg_dump failed")

            # Calculate checksum
            checksum = self._calculate_checksum(backup_path)
            self.logger.info(f"Backup checksum: {checksum}")

            # Update backup record with file information
            self.backup_record.file_path = str(backup_path)
            self.backup_record.file_size = backup_path.stat().st_size
            self.backup_record.checksum = checksum

            # Handle media files if requested
            if include_media:
                self.logger.info("Including media files in backup")
                media_success = self._backup_media_files(backup_dir, timestamp)
                if not media_success:
                    self.logger.warning("Media backup failed, continuing without media")

            # Mark as completed
            # Use direct database update to avoid ORM caching issues
            completed_at = timezone.now()
            BackupRecord.objects.filter(id=self.backup_record.id).update(
                status='completed',
                completed_at=completed_at,
                file_path=str(backup_path),
                file_size=backup_path.stat().st_size,
                checksum=checksum
            )
            # Update local object for logging
            self.backup_record.status = 'completed'
            self.backup_record.completed_at = completed_at
            self.backup_record.file_path = str(backup_path)
            self.backup_record.file_size = backup_path.stat().st_size
            self.backup_record.checksum = checksum

            self.logger.info(
                f"Backup completed successfully. "
                f"Size: {self.backup_record.size_mb} MB, "
                f"Duration: {self.backup_record.duration}"
            )

            # Clean up old backups based on retention policy
            self._cleanup_old_backups()

            return (True, None)

        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Backup failed: {error_msg}")
            self.backup_record.status = 'failed'
            self.backup_record.error_message = error_msg
            self.backup_record.completed_at = timezone.now()
            self.backup_record.save()
            return (False, error_msg)

    def _create_pg_dump(self, backup_path):
        """Execute pg_dump to create database backup"""
        try:
            db_config = settings.DATABASES['default']

            env = os.environ.copy()
            env['PGPASSWORD'] = db_config['PASSWORD']

            cmd = [
                'pg_dump',
                '--host', db_config['HOST'],
                '--port', str(db_config['PORT']),
                '--username', db_config['USER'],
                '--dbname', db_config['NAME'],
                '--format', 'custom',  # Custom format for flexibility
                '--file', str(backup_path),
                '--verbose',
                # Exclude backup tables to prevent corruption during restore
                '--exclude-table=public.backup_backuprecord',
                '--exclude-table=public.backup_backuplog',
                '--exclude-table=public.backup_restorerecord',
                '--exclude-table=public.backup_backupconfiguration',
            ]

            if self.config.use_compression:
                cmd.extend(['--compress', '6'])  # Compression level 6

            self.logger.info(f"Executing: {' '.join(cmd[:-2])}...")  # Don't log password

            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            if result.returncode != 0:
                self.logger.error(f"pg_dump stderr: {result.stderr}")
                return False

            self.logger.info("pg_dump completed successfully")
            return True

        except subprocess.TimeoutExpired:
            self.logger.error("pg_dump timed out after 1 hour")
            return False
        except Exception as e:
            self.logger.error(f"pg_dump error: {str(e)}")
            return False

    def _backup_media_files(self, backup_dir, timestamp):
        """Create tar archive of media files"""
        try:
            media_root = Path(settings.MEDIA_ROOT)
            if not media_root.exists():
                self.logger.warning("Media directory does not exist")
                return False

            media_filename = f"sanbox_media_{timestamp}.tar.gz"
            media_path = backup_dir / media_filename

            self.logger.info(f"Creating media archive: {media_path}")

            with tarfile.open(media_path, 'w:gz') as tar:
                tar.add(media_root, arcname='media')

            self.backup_record.includes_media = True
            self.backup_record.media_file_path = str(media_path)
            self.backup_record.media_file_size = media_path.stat().st_size
            self.backup_record.save()

            self.logger.info(f"Media backup completed: {media_path.stat().st_size} bytes")
            return True

        except Exception as e:
            self.logger.error(f"Media backup error: {str(e)}")
            return False

    def _collect_version_info(self):
        """Collect version information about the application"""
        import django
        import platform

        try:
            self.backup_record.django_version = django.get_version()[:50]
            self.backup_record.python_version = platform.python_version()[:50]

            # Get app version from git if available
            try:
                result = subprocess.run(
                    ['git', 'describe', '--tags', '--always'],
                    capture_output=True,
                    text=True,
                    timeout=5,
                    cwd=settings.BASE_DIR
                )
                if result.returncode == 0:
                    self.backup_record.app_version = result.stdout.strip()[:50]
            except:
                self.backup_record.app_version = 'unknown'

            # Get PostgreSQL version
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT version()")
                    pg_version = cursor.fetchone()[0]
                    # Store full version but truncate if needed
                    self.backup_record.postgres_version = pg_version[:255]
                    self.logger.info(f"PostgreSQL version: {pg_version}")
            except Exception as e:
                self.logger.warning(f"Could not get PostgreSQL version: {e}")
                self.backup_record.postgres_version = 'unknown'

            self.backup_record.save()
            self.logger.info(
                f"Version info collected - Django: {self.backup_record.django_version}, "
                f"Python: {self.backup_record.python_version}, "
                f"PostgreSQL: {self.backup_record.postgres_version}"
            )
        except Exception as e:
            self.logger.error(f"Error collecting version info: {e}")
            # Set defaults and continue
            if not self.backup_record.django_version:
                self.backup_record.django_version = 'unknown'
            if not self.backup_record.python_version:
                self.backup_record.python_version = 'unknown'
            if not self.backup_record.postgres_version:
                self.backup_record.postgres_version = 'unknown'
            self.backup_record.save()

    def _collect_schema_info(self):
        """Collect schema and migration information"""
        # Get migration state for all apps
        from django.db.migrations.recorder import MigrationRecorder

        migration_state = {}
        recorder = MigrationRecorder(connection)

        for app_config in apps.get_app_configs():
            app_migrations = recorder.migration_qs.filter(app=app_config.label).values_list('name', flat=True)
            migration_state[app_config.label] = list(app_migrations)

        self.backup_record.migration_state = migration_state

        # Get installed apps list
        self.backup_record.installed_apps = list(settings.INSTALLED_APPS)
        self.backup_record.save()

    def _collect_database_stats(self):
        """Collect database statistics"""
        try:
            # Get database size
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_database_size(%s)",
                    [settings.DATABASES['default']['NAME']]
                )
                self.backup_record.database_size = cursor.fetchone()[0]

            # Get row counts for all tables
            table_counts = {}
            for model in apps.get_models():
                try:
                    table_counts[model._meta.db_table] = model.objects.count()
                except:
                    pass  # Skip tables that can't be counted

            self.backup_record.table_counts = table_counts
            self.backup_record.save()

        except Exception as e:
            self.logger.warning(f"Could not collect database stats: {str(e)}")

    def _calculate_checksum(self, file_path):
        """Calculate SHA256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def _cleanup_old_backups(self):
        """Remove old backups based on retention policy"""
        try:
            config = BackupConfiguration.get_config()

            # Delete by count limit
            if config.max_backups > 0:
                old_backups = BackupRecord.objects.filter(
                    status='completed'
                ).order_by('-created_at')[config.max_backups:]

                for backup in old_backups:
                    self._delete_backup_files(backup)
                    backup.delete()
                    self.logger.info(f"Deleted old backup: {backup.name}")

            # Delete by age
            if config.retention_days > 0:
                cutoff_date = datetime.now() - timedelta(days=config.retention_days)
                old_backups = BackupRecord.objects.filter(
                    status='completed',
                    created_at__lt=cutoff_date
                )

                for backup in old_backups:
                    self._delete_backup_files(backup)
                    backup.delete()
                    self.logger.info(f"Deleted expired backup: {backup.name}")

        except Exception as e:
            self.logger.warning(f"Cleanup error: {str(e)}")

    def _delete_backup_files(self, backup):
        """Delete backup files from filesystem"""
        try:
            if backup.file_path and os.path.exists(backup.file_path):
                os.remove(backup.file_path)
            if backup.media_file_path and os.path.exists(backup.media_file_path):
                os.remove(backup.media_file_path)
        except Exception as e:
            self.logger.warning(f"Could not delete files for {backup.name}: {str(e)}")

    def verify_backup(self):
        """Verify backup integrity"""
        try:
            self.backup_record.status = 'verifying'
            self.backup_record.save()

            self.logger.info("Verifying backup integrity")

            # Check if file exists
            if not os.path.exists(self.backup_record.file_path):
                raise Exception("Backup file not found")

            # Verify checksum
            current_checksum = self._calculate_checksum(self.backup_record.file_path)
            if current_checksum != self.backup_record.checksum:
                raise Exception("Checksum mismatch - backup file may be corrupted")

            # Try to list contents using pg_restore
            db_config = settings.DATABASES['default']
            result = subprocess.run(
                [
                    'pg_restore',
                    '--list',
                    self.backup_record.file_path
                ],
                capture_output=True,
                text=True,
                timeout=60
            )

            if result.returncode != 0:
                raise Exception("pg_restore --list failed")

            self.backup_record.status = 'verified'
            self.backup_record.save()

            self.logger.info("Backup verified successfully")
            return (True, None)

        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Verification failed: {error_msg}")
            self.backup_record.status = 'failed'
            self.backup_record.error_message = error_msg
            self.backup_record.save()
            return (False, error_msg)


class RestoreLogger:
    """Logger for restore operations - logs to Python logging instead of database"""

    def __init__(self, restore_record):
        import logging
        self.restore_record = restore_record
        self.py_logger = logging.getLogger(f'backup.restore.{restore_record.id}')

    def debug(self, message, details=None):
        self.py_logger.debug(f"Restore #{self.restore_record.id}: {message}")

    def info(self, message, details=None):
        self.py_logger.info(f"Restore #{self.restore_record.id}: {message}")

    def warning(self, message, details=None):
        self.py_logger.warning(f"Restore #{self.restore_record.id}: {message}")

    def error(self, message, details=None):
        self.py_logger.error(f"Restore #{self.restore_record.id}: {message}")


class RestoreService:
    """Service for restoring database from backups"""

    def __init__(self, restore_record):
        self.restore_record = restore_record
        self.backup_record = restore_record.backup
        self.logger = RestoreLogger(restore_record)

    def restore_backup(self):
        """
        Restore database from backup

        Returns:
            tuple: (success: bool, error_message: str or None)
        """
        try:
            self.logger.info("Starting restore process")
            self.restore_record.status = 'validating'
            self.restore_record.save()

            # Validate backup
            validation_result = self._validate_backup()
            if not validation_result[0]:
                raise Exception(f"Backup validation failed: {validation_result[1]}")

            # Check schema compatibility
            self._check_schema_compatibility()

            # Create pre-restore backup
            self.restore_record.status = 'pre_backup'
            self.restore_record.save()
            pre_backup = self._create_pre_restore_backup()
            if pre_backup:
                self.restore_record.pre_restore_backup = pre_backup
                self.restore_record.save()

            # Perform restore
            self.restore_record.status = 'restoring'
            self.restore_record.save()

            success = self._perform_restore()
            if not success:
                raise Exception("Database restore failed")

            # Restore media files if requested
            if self.restore_record.restore_media and self.backup_record.includes_media:
                self._restore_media_files()

            # Run migrations if needed
            if self.restore_record.run_migrations and self.restore_record.migration_plan:
                self.restore_record.status = 'migrating'
                self.restore_record.save()
                self._run_migrations()

            # Mark as completed
            # NOTE: Do NOT refresh_from_db() here! The database was just restored,
            # so the RestoreRecord we're working with may no longer exist in the DB.
            # We need to recreate it after the restore.
            try:
                # Try to update if it still exists
                RestoreRecord.objects.filter(id=self.restore_record.id).update(
                    status='completed',
                    completed_at=timezone.now()
                )
            except Exception:
                # If it doesn't exist, recreate it
                self.restore_record.id = None  # Clear ID to force INSERT
                self.restore_record.status = 'completed'
                self.restore_record.completed_at = timezone.now()
                self.restore_record.save()

            self.logger.info(f"Restore completed successfully")
            return (True, None)

        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Restore failed: {error_msg}")
            self.restore_record.status = 'failed'
            self.restore_record.error_message = error_msg
            self.restore_record.completed_at = timezone.now()
            self.restore_record.save()
            return (False, error_msg)

    def _validate_backup(self):
        """Validate backup file before restore"""
        try:
            # Check if file exists
            if not os.path.exists(self.backup_record.file_path):
                return (False, "Backup file not found")

            # Verify checksum
            service = BackupService(self.backup_record)
            current_checksum = service._calculate_checksum(self.backup_record.file_path)
            if current_checksum != self.backup_record.checksum:
                return (False, "Checksum mismatch - backup file may be corrupted")

            self.logger.info("Backup validation passed")
            return (True, None)

        except Exception as e:
            return (False, str(e))

    def _check_schema_compatibility(self):
        """Check if backup schema is compatible with current code"""
        from django.db.migrations.recorder import MigrationRecorder

        # Get current migration state
        current_migrations = {}
        recorder = MigrationRecorder(connection)

        for app_config in apps.get_app_configs():
            app_migrations = recorder.migration_qs.filter(app=app_config.label).values_list('name', flat=True)
            current_migrations[app_config.label] = set(app_migrations)

        # Compare with backup migration state
        backup_migrations = {
            app: set(migrations)
            for app, migrations in self.backup_record.migration_state.items()
        }

        # Find migrations that need to be run
        migration_plan = []
        warnings = []

        for app, current_migs in current_migrations.items():
            backup_migs = backup_migrations.get(app, set())

            # Migrations in current code but not in backup (need to run forward)
            forward_migs = current_migs - backup_migs
            if forward_migs:
                migration_plan.append({
                    'app': app,
                    'direction': 'forward',
                    'migrations': list(forward_migs)
                })

            # Migrations in backup but not in current code (potential issue)
            backward_migs = backup_migs - current_migs
            if backward_migs:
                warnings.append({
                    'app': app,
                    'issue': 'backup_has_newer_migrations',
                    'migrations': list(backward_migs),
                    'message': f'Backup has migrations not in current code for {app}. Code may need to be updated.'
                })

        # Check for exact match
        schema_compatible = len(migration_plan) == 0 and len(warnings) == 0

        self.restore_record.schema_compatible = schema_compatible
        self.restore_record.migration_plan = migration_plan if migration_plan else None
        self.restore_record.compatibility_warnings = warnings if warnings else None
        self.restore_record.save()

        if not schema_compatible:
            if warnings:
                self.logger.warning(f"Schema compatibility warnings: {len(warnings)}")
            if migration_plan:
                self.logger.info(f"Will run {len(migration_plan)} migration groups after restore")

    def _create_pre_restore_backup(self):
        """Create safety backup before restore"""
        try:
            self.logger.info("Creating pre-restore safety backup")

            from django.contrib.auth import get_user_model
            User = get_user_model()

            # Create backup record
            pre_backup = BackupRecord.objects.create(
                name=f"Pre-restore safety backup - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                description=f"Automatic backup before restoring from: {self.backup_record.name}",
                created_by=self.restore_record.started_by,
                backup_type='full',
                django_version='',  # Will be filled by service
                python_version='',
                migration_state={},
                installed_apps=[]
            )

            # Create backup
            service = BackupService(pre_backup)
            success, error = service.create_backup(include_media=False)

            if success:
                self.logger.info("Pre-restore backup created successfully")
                return pre_backup
            else:
                self.logger.warning(f"Pre-restore backup failed: {error}")
                return None

        except Exception as e:
            self.logger.warning(f"Could not create pre-restore backup: {str(e)}")
            return None

    def _perform_restore(self):
        """Execute pg_restore to restore database"""
        try:
            db_config = settings.DATABASES['default']

            env = os.environ.copy()
            env['PGPASSWORD'] = db_config['PASSWORD']

            # Drop and recreate database (or restore over existing)
            # For safety, we'll restore over existing and let pg_restore handle conflicts

            cmd = [
                'pg_restore',
                '--host', db_config['HOST'],
                '--port', str(db_config['PORT']),
                '--username', db_config['USER'],
                '--dbname', db_config['NAME'],
                '--clean',  # Clean (drop) database objects before recreating
                '--if-exists',  # Use IF EXISTS when dropping objects
                '--no-owner',  # Don't restore ownership
                '--no-privileges',  # Don't restore access privileges
                '--verbose',
                self.backup_record.file_path
            ]

            self.logger.info("Executing pg_restore...")

            result = subprocess.run(
                cmd,
                env=env,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout
            )

            # pg_restore may return non-zero even on success due to warnings
            # Check stderr for critical errors
            if result.returncode != 0:
                # Filter stderr to remove non-critical warnings before logging
                filtered_lines = []
                critical_errors = []

                for line in result.stderr.split('\n'):
                    lower_line = line.lower()

                    # Skip empty lines
                    if not line.strip():
                        continue

                    # Skip known non-critical warnings and messages
                    if 'warning:' in lower_line:
                        continue
                    if 'unrecognized configuration parameter' in lower_line:
                        continue
                    if 'errors ignored on restore' in lower_line:
                        continue
                    if 'transaction_timeout' in lower_line:
                        continue
                    # Skip verbose pg_restore progress messages
                    if line.startswith('pg_restore: creating') or line.startswith('pg_restore: dropping'):
                        continue
                    if line.startswith('pg_restore: connecting to database'):
                        continue
                    if line.startswith('pg_restore: while INITIALIZING'):
                        continue

                    # Check for actual fatal errors
                    if 'fatal' in lower_line and 'error:' in lower_line:
                        critical_errors.append(line)

                    # Keep other potentially important messages
                    if 'error' in lower_line or 'fatal' in lower_line:
                        filtered_lines.append(line)

                # Only log if there are filtered messages (not just verbose output)
                if filtered_lines:
                    self.logger.warning(f"pg_restore messages: {'; '.join(filtered_lines[:10])}")

                if critical_errors:
                    self.logger.error(f"Critical restore errors: {critical_errors}")
                    return False

            self.logger.info("pg_restore completed")
            return True

        except subprocess.TimeoutExpired:
            self.logger.error("pg_restore timed out after 1 hour")
            return False
        except Exception as e:
            self.logger.error(f"pg_restore error: {str(e)}")
            return False

    def _restore_media_files(self):
        """Restore media files from archive"""
        try:
            if not os.path.exists(self.backup_record.media_file_path):
                self.logger.warning("Media archive not found")
                return False

            self.logger.info("Restoring media files")

            media_root = Path(settings.MEDIA_ROOT)

            # Extract tar archive
            with tarfile.open(self.backup_record.media_file_path, 'r:gz') as tar:
                tar.extractall(path=media_root.parent)

            self.logger.info("Media files restored successfully")
            return True

        except Exception as e:
            self.logger.error(f"Media restore error: {str(e)}")
            return False

    def _run_migrations(self):
        """Run pending migrations after restore"""
        try:
            migrations_run = []

            for migration_group in self.restore_record.migration_plan:
                app = migration_group['app']
                self.logger.info(f"Running migrations for {app}")

                try:
                    # Run migrate for this app
                    call_command('migrate', app, verbosity=0)
                    migrations_run.append(migration_group)
                except Exception as e:
                    self.logger.error(f"Migration failed for {app}: {str(e)}")
                    raise

            self.restore_record.migrations_run = migrations_run
            self.restore_record.save()

            self.logger.info(f"Ran migrations for {len(migrations_run)} apps")
            return True

        except Exception as e:
            self.logger.error(f"Migration error: {str(e)}")
            return False
