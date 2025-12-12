# Sanbox - Deployment Guide for Test and Production Servers

## Overview

This guide explains how to deploy Sanbox to your lab servers with proper security configurations.

## Environment Structure

| Environment | Location | Settings File | Purpose |
|------------|----------|---------------|---------|
| **Development** | Mac (local) | `settings.py` | Local development with hot-reload |
| **Test** | Lab server | `settings_docker.py` or `settings_production.py` | Testing before production |
| **Production** | Lab server | `settings_production.py` | Live production environment |

---

## 🚨 Security Changes Made

### Fixed in `settings_production.py`:
1. ✅ Removed hardcoded database password
2. ✅ Added environment variable configuration
3. ✅ Restricted ALLOWED_HOSTS
4. ✅ Added production security headers
5. ✅ Enabled HTTPS security settings

### Your Local Development (Mac):
- ✅ No changes needed - continues to work as before
- ✅ DEBUG=True for hot-reload
- ✅ Uses SQLite for fast development

---

## Production Server Deployment

### Step 1: Generate Secure Keys

On your production server, generate a secure SECRET_KEY:

```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Save this key - you'll need it for the .env file.

### Step 2: Create Production Environment File

On your production server:

```bash
cd /var/www/sanbox  # or your deployment directory
cp .env.production.template .env.production
```

Edit `.env.production` and fill in:

```bash
# CRITICAL: Use the key you generated in Step 1
DJANGO_SECRET_KEY=your-generated-key-here

# Database password (use your actual password)
POSTGRES_PASSWORD=ESI@2022bpic  # or your actual password

# Your production domain
ALLOWED_HOSTS=sanbox.esilabs.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://sanbox.esilabs.com,http://sanbox.esilabs.com
CSRF_TRUSTED_ORIGINS=https://sanbox.esilabs.com,http://sanbox.esilabs.com

# Enable HTTPS security (if using SSL)
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

### Step 3: Set Django Settings Module

Tell Django to use production settings:

**Option A: Environment Variable (Recommended)**
```bash
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
```

Add this to your systemd service file or PM2 config.

**Option B: In your startup script**
```bash
# In your start script
DJANGO_SETTINGS_MODULE=sanbox.settings_production python manage.py runserver
```

### Step 4: Load Environment Variables

Make sure your environment file is loaded:

```bash
# If using systemd
EnvironmentFile=/var/www/sanbox/.env.production

# If using PM2
pm2 start ecosystem.config.js --env production

# If using shell script
source /var/www/sanbox/.env.production
```

### Step 5: Verify Configuration

Test that settings load correctly:

```bash
cd /var/www/sanbox/backend
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
source ../.env.production
python manage.py check --deploy
```

This will show any security warnings or configuration issues.

### Step 6: Restart Services

```bash
# If using systemd
sudo systemctl restart sanbox-backend
sudo systemctl restart sanbox-celery

# If using PM2
pm2 restart sanbox

# If using gunicorn directly
sudo systemctl restart gunicorn
```

---

## Test Server Deployment

Follow the same steps as production, but use `.env.test.template`:

```bash
cd /var/www/sanbox-test
cp .env.test.template .env.test
# Edit .env.test with test-specific values
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
source .env.test
python manage.py check --deploy
```

---

## Verification Checklist

After deployment, verify:

### Security Checks
- [ ] No hardcoded passwords in settings files
- [ ] SECRET_KEY is loaded from environment
- [ ] ALLOWED_HOSTS is restricted to your domain
- [ ] CORS_ALLOWED_ORIGINS is restricted
- [ ] HTTPS security headers are enabled (if using SSL)
- [ ] Database password is from environment variable

### Functionality Checks
- [ ] Application starts without errors
- [ ] Can log in to admin panel
- [ ] Database connections work
- [ ] Redis/Celery workers are running
- [ ] Static files are served correctly
- [ ] API endpoints respond correctly

### Run Django's Security Check
```bash
python manage.py check --deploy
```

This command will warn you about any security issues.

---

## Environment Variables Reference

### Required Variables (Must Set)
```bash
DJANGO_SECRET_KEY=<secure-random-key>
POSTGRES_PASSWORD=<database-password>
```

### Important Variables
```bash
DEBUG=False                          # Always False in production
ALLOWED_HOSTS=your-domain.com        # Your actual domain
POSTGRES_DB=sanbox_db               # Database name
POSTGRES_USER=sanbox_user           # Database user
POSTGRES_HOST=localhost             # Database host
```

### Security Variables (Production)
```bash
SECURE_SSL_REDIRECT=True            # Redirect HTTP to HTTPS
SESSION_COOKIE_SECURE=True          # Secure session cookies
CSRF_COOKIE_SECURE=True             # Secure CSRF cookies
CORS_ALLOWED_ORIGINS=https://...    # Allowed frontend origins
CSRF_TRUSTED_ORIGINS=https://...    # Trusted CSRF origins
```

---

## Troubleshooting

### Issue: "DJANGO_SECRET_KEY environment variable must be set"

**Solution:** Make sure you've:
1. Created the .env.production file
2. Added DJANGO_SECRET_KEY to it
3. Loaded the environment file before starting Django

```bash
source /path/to/.env.production
python manage.py runserver
```

### Issue: "POSTGRES_PASSWORD environment variable must be set"

**Solution:** Add POSTGRES_PASSWORD to your .env file:
```bash
POSTGRES_PASSWORD=your-actual-password
```

### Issue: "DisallowedHost at /"

**Solution:** Add your domain to ALLOWED_HOSTS:
```bash
ALLOWED_HOSTS=sanbox.esilabs.com,localhost,127.0.0.1
```

### Issue: CORS errors in browser

**Solution:** Add your frontend domain to CORS_ALLOWED_ORIGINS:
```bash
CORS_ALLOWED_ORIGINS=https://sanbox.esilabs.com,http://sanbox.esilabs.com
```

---

## Rollback Plan

If something goes wrong, you can quickly rollback:

### Option 1: Revert to Old Settings (Temporary)
```bash
# Temporarily use old settings with hardcoded values
export DJANGO_SETTINGS_MODULE=sanbox.settings
sudo systemctl restart sanbox-backend
```

### Option 2: Use Docker Settings
```bash
# Use the Docker settings which are already environment-aware
export DJANGO_SETTINGS_MODULE=sanbox.settings_docker
sudo systemctl restart sanbox-backend
```

---

## Migration Path

### Current State (Before Changes)
- ❌ Hardcoded database password in settings_production.py
- ❌ ALLOWED_HOSTS = ['*']
- ❌ No security headers

### After Deployment (Secure)
- ✅ All secrets in environment variables
- ✅ Restricted ALLOWED_HOSTS
- ✅ Production security headers enabled
- ✅ HTTPS security configured

---

## Next Steps

After successful deployment:

1. **Monitor logs** for any errors:
   ```bash
   tail -f /var/www/sanbox/logs/django.log
   ```

2. **Test all functionality**:
   - Login/authentication
   - Data import
   - SAN operations
   - Backup operations

3. **Set up monitoring** (Phase 6 of improvement plan):
   - Application monitoring
   - Error tracking
   - Performance metrics

4. **Implement remaining improvements**:
   - Code quality tools (Phase 2)
   - Testing infrastructure (Phase 3)
   - CI/CD pipeline (Phase 5)

---

## Support

If you encounter issues:

1. Check Django's deployment checklist:
   ```bash
   python manage.py check --deploy
   ```

2. Review logs:
   ```bash
   tail -f /var/www/sanbox/logs/django.log
   tail -f /var/www/sanbox/logs/celery.log
   ```

3. Verify environment variables are loaded:
   ```bash
   python -c "import os; print(os.environ.get('DJANGO_SECRET_KEY', 'NOT SET'))"
   ```

---

## Summary

✅ **What Changed:**
- settings_production.py now uses environment variables
- Added .env.production.template and .env.test.template
- Added security headers for production
- Documented local development setup

✅ **What Stayed the Same:**
- Local development on Mac (no changes needed)
- Docker deployment (settings_docker.py already secure)
- Application functionality

✅ **What You Need to Do:**
1. Generate SECRET_KEY for production
2. Create .env.production on production server
3. Set DJANGO_SETTINGS_MODULE=sanbox.settings_production
4. Restart services
5. Verify with `python manage.py check --deploy`