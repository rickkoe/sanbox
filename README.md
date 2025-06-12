# Sanbox React + Django Deployment Runbook

## Overview

This runbook documents the deployment architecture and procedures for the Sanbox application, which consists of a React frontend and Django backend deployed on RHEL 9.

## Architecture

```
Internet → Nginx (Port 80) → Django (Port 8000)
                ↓
        React Static Files
        Django Admin Files
        API Proxy
```

### Technology Stack

- **Frontend**: React 18 with Node.js/npm
- **Backend**: Django 5.1.6 with Python 3.11
- **Database**: PostgreSQL 
- **Web Server**: Nginx
- **Process Manager**: PM2
- **Operating System**: RHEL 9

### Server Structure

```
/var/www/sanbox/
├── backend/               # Django application
│   ├── manage.py
│   ├── requirements.txt
│   ├── static/           # Collected Django static files
│   └── sanbox/           # Django project
│       ├── settings.py
│       └── settings_production.py
├── frontend/             # React application
│   ├── build/           # Production React build
│   ├── package.json
│   └── src/
├── venv/                # Python virtual environment
├── logs/                # Application logs
├── ecosystem.config.js  # PM2 configuration
└── deploy.sh           # Deployment script
```

## Initial Setup

### Prerequisites

1. RHEL 9 server with root access
2. Git repository with application code
3. Domain name (optional): sanbox.esilabs.com

### System Dependencies

```bash
# Update system
sudo dnf update -y

# Install required packages
sudo dnf install python3.11 python3.11-pip nodejs npm git nginx postgresql postgresql-server postgresql-contrib -y

# Install PM2 globally
sudo npm install -g pm2
```

### Database Setup

```bash
# Initialize PostgreSQL (if not already done)
sudo postgresql-setup --initdb

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
CREATE DATABASE sanbox_db;
CREATE USER sanbox_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sanbox_db TO sanbox_user;
ALTER USER sanbox_user CREATEDB;
\q
```

### PostgreSQL Authentication

Edit `/var/lib/pgsql/data/pg_hba.conf`:
```bash
sudo nano /var/lib/pgsql/data/pg_hba.conf
```

Change authentication method from `ident` to `md5`:
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            md5
# IPv6 local connections:
host    all             all             ::1/128                 md5
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

## Application Deployment

### Initial Deployment

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/rickkoe/sanbox.git
cd sanbox

# Create Python virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Configure database
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser

# Build React frontend
cd ../frontend
npm install --legacy-peer-deps
npm run build

# Setup PM2
cd ..
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

### Configuration Files

#### Django Production Settings (`backend/sanbox/settings_production.py`)

```python
from .settings import *

# Production database configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'sanbox_db',
        'USER': 'sanbox_user',
        'PASSWORD': 'your_secure_password',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

# Production-specific settings
DEBUG = False
ALLOWED_HOSTS = ['sanbox.esilabs.com', 'your_server_ip', 'localhost']
```

#### PM2 Configuration (`ecosystem.config.js`)

```javascript
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
```

#### Nginx Configuration (`/etc/nginx/conf.d/sanbox.conf`)

```nginx
server {
    listen 80;
    server_name sanbox.esilabs.com localhost your_server_ip;

    # Django admin static files (highest priority)
    location /django-static/ {
        alias /var/www/sanbox/backend/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # React static files
    location /static/ {
        root /var/www/sanbox/frontend/build;
        try_files $uri =404;
    }

    # Django API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Django admin
    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # React app (catch-all)
    location / {
        root /var/www/sanbox/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

#### Deployment Script (`deploy.sh`)

```bash
#!/bin/bash
set -e

APP_DIR="/var/www/sanbox"
BRANCH="main"

echo "========================================="
echo "Starting deployment at $(date)"
echo "========================================="

cd $APP_DIR

echo "📥 Pulling latest changes from GitHub..."
git pull origin $BRANCH

echo "🔧 Updating backend..."
cd backend
source ../venv/bin/activate

echo "   Installing Python dependencies..."
pip install -r requirements.txt

echo "   Running database migrations..."
python manage.py migrate

echo "   Collecting static files..."
python manage.py collectstatic --noinput

echo "🎨 Building frontend..."
cd ../frontend

echo "   Installing Node dependencies..."
npm install --legacy-peer-deps

echo "   Building React app..."
npm run build

echo "🚀 Restarting services..."
cd ..

echo "   Restarting Django..."
pm2 restart sanbox-django

echo "   Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment completed successfully!"
echo "========================================="
echo "Services status:"
pm2 status

echo ""
echo "🌐 Your app is available at:"
echo "   Frontend: http://$(hostname -I | awk '{print $1}')/"
echo "   Admin:    http://$(hostname -I | awk '{print $1}')/admin/"
echo ""
echo "📋 To check logs:"
echo "   Django logs: pm2 logs sanbox-django"
echo "   Nginx logs:  sudo tail -f /var/log/nginx/error.log"
echo "========================================="
```

## Daily Operations

### Deployment Workflow

**Development (on Mac):**
```bash
# Make changes
git add .
git commit -m "Your changes"
git push origin main
```

**Production (on server):**
```bash
cd /var/www/sanbox
./deploy.sh
```

### Service Management

#### PM2 Commands
```bash
# Check status
pm2 status

# View logs
pm2 logs sanbox-django
pm2 logs sanbox-django --lines 50

# Restart application
pm2 restart sanbox-django

# Stop application
pm2 stop sanbox-django

# Start application
pm2 start ecosystem.config.js
```

#### Nginx Commands
```bash
# Check status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Reload configuration
sudo systemctl reload nginx

# View logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

#### PostgreSQL Commands
```bash
# Check status
sudo systemctl status postgresql

# Connect to database
sudo -u postgres psql sanbox_db

# Backup database
sudo -u postgres pg_dump sanbox_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
sudo -u postgres psql sanbox_db < backup_file.sql
```

### File Permissions

```bash
# Fix React build permissions
sudo chown -R nginx:nginx /var/www/sanbox/frontend/build/
sudo chmod -R 755 /var/www/sanbox/frontend/build/

# Fix Django static files permissions
sudo chown -R nginx:nginx /var/www/sanbox/backend/static/
sudo chmod -R 755 /var/www/sanbox/backend/static/
```

## Application URLs

- **Frontend**: http://sanbox.esilabs.com/
- **Admin Panel**: http://sanbox.esilabs.com/admin/
- **API**: http://sanbox.esilabs.com/api/

**Important**: Always use the domain/IP without port numbers. Direct access to port 8000 bypasses Nginx and will cause styling issues.

## Troubleshooting

### Common Issues

#### Django Admin Styling Issues
**Problem**: Admin interface appears unstyled
**Cause**: Accessing Django directly on port 8000
**Solution**: Use http://sanbox.esilabs.com/admin/ instead of :8000/admin/

#### API 403 Errors
**Problem**: CSRF token errors on API calls
**Solutions**:
1. Ensure API calls go through Nginx (no :8000)
2. Add CSRF_TRUSTED_ORIGINS to Django settings
3. Use DRF's built-in CSRF handling

#### Static Files Not Loading
**Problem**: 404 errors for CSS/JS files
**Solutions**:
1. Run `python manage.py collectstatic --noinput`
2. Check file permissions
3. Verify Nginx configuration

#### Database Connection Issues
**Problem**: Django can't connect to PostgreSQL
**Solutions**:
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Verify pg_hba.conf authentication settings
3. Ensure production settings are being used

### Health Checks

```bash
# Quick system health check
echo "=== System Health Check ==="
echo "PostgreSQL:" $(sudo systemctl is-active postgresql)
echo "Nginx:" $(sudo systemctl is-active nginx)
echo "PM2 Django:" $(pm2 describe sanbox-django | grep status | awk '{print $4}')

# Test endpoints
curl -s -o /dev/null -w "%{http_code}" http://localhost/
curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/
```

### Log Locations

- **Django**: `/var/www/sanbox/logs/`
- **PM2**: `pm2 logs sanbox-django`
- **Nginx**: `/var/log/nginx/`
- **PostgreSQL**: `/var/lib/pgsql/data/log/`

## Security Considerations

### Production Security Checklist

- [ ] Change default Django SECRET_KEY
- [ ] Set DEBUG = False in production
- [ ] Configure proper ALLOWED_HOSTS
- [ ] Use strong PostgreSQL passwords
- [ ] Consider implementing SSL/HTTPS
- [ ] Regular security updates
- [ ] Database backups
- [ ] Monitor logs for suspicious activity

### SSL/HTTPS Setup (Optional)

```bash
# Install Certbot
sudo dnf install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d sanbox.esilabs.com

# Auto-renewal
sudo systemctl enable certbot-renew.timer
```

## Backup Procedures

### Database Backup
```bash
# Create backup script
sudo -u postgres pg_dump sanbox_db > /backup/sanbox_db_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (add to crontab)
0 2 * * * /usr/bin/sudo -u postgres pg_dump sanbox_db > /backup/sanbox_db_$(date +\%Y\%m\%d_\%H\%M\%S).sql
```

### Application Backup
```bash
# Backup application files (excluding node_modules and .git)
tar -czf sanbox_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='venv' \
  /var/www/sanbox/
```

## Contact Information

- **Repository**: https://github.com/rickkoe/sanbox
- **Server**: RHEL 9
- **Domain**: sanbox.esilabs.com

---

*Last Updated: June 2025*