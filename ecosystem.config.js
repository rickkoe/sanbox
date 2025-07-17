module.exports = {
  apps: [
    {
      name: 'sanbox-django',
      cwd: '/var/www/sanbox/backend',
      script: '/var/www/sanbox/venv/bin/python',
      args: 'manage.py runserver 0.0.0.0:8000',
      env: {
        DJANGO_SETTINGS_MODULE: 'sanbox.settings_production'
      },
      error_file: '/var/www/sanbox/logs/django-error.log',
      out_file: '/var/www/sanbox/logs/django-out.log',
      log_file: '/var/www/sanbox/logs/django-combined.log'
    },
    {
      name: 'sanbox-celery-worker',
      cwd: '/var/www/sanbox/backend',
      script: '/var/www/sanbox/venv/bin/python',
      args: '-m celery -A sanbox worker --loglevel=info',
      env: {
        DJANGO_SETTINGS_MODULE: 'sanbox.settings_production'
      },
      error_file: '/var/www/sanbox/logs/celery-worker-error.log',
      out_file: '/var/www/sanbox/logs/celery-worker-out.log',
      log_file: '/var/www/sanbox/logs/celery-worker-combined.log'
    },
    {
      name: 'sanbox-celery-beat',
      cwd: '/var/www/sanbox/backend',
      script: '/var/www/sanbox/venv/bin/python',
      args: '-m celery -A sanbox beat --loglevel=info',
      env: {
        DJANGO_SETTINGS_MODULE: 'sanbox.settings_production'
      },
      error_file: '/var/www/sanbox/logs/celery-beat-error.log',
      out_file: '/var/www/sanbox/logs/celery-beat-out.log',
      log_file: '/var/www/sanbox/logs/celery-beat-combined.log'
    }
  ]
};