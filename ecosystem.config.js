module.exports = {
  apps: [{
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
  }]
};
//         // imported, updated, and saved are handled in the frontend
