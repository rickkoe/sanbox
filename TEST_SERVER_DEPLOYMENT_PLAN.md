# Test Server Deployment Plan - Step by Step

## Overview

This guide walks you through deploying the security improvements from the "bob" branch to your test server safely.

---

## Pre-Deployment Checklist

Before you start, gather this information about your test server:

- [ ] Test server hostname/IP: `_________________`
- [ ] Deployment directory: `_________________` (e.g., `/var/www/sanbox-test`)
- [ ] Current Django settings module: `_________________`
- [ ] How you currently deploy (git pull, rsync, etc.): `_________________`
- [ ] Service management (systemd, PM2, supervisor): `_________________`
- [ ] Database password: `_________________`

---

## Deployment Strategy

We'll use a **safe, reversible approach**:

1. ✅ Push bob branch to remote
2. ✅ Pull bob branch on test server
3. ✅ Create .env.test file with secrets
4. ✅ Test configuration without restarting
5. ✅ Restart services
6. ✅ Verify everything works
7. ✅ Rollback if needed (easy!)

---

## Step 1: Push "bob" Branch to Remote (On Your Mac)

### Option A: If you have a remote repository (GitHub, GitLab, etc.)

```bash
# Make sure you're on bob branch
git branch
# Should show: * bob

# Push bob branch to remote
git push origin bob

# Or if this is the first time pushing bob:
git push -u origin bob
```

### Option B: If you don't have a remote repository

You can use rsync or scp to copy files directly to test server (see Step 2B).

---

## Step 2: Get Code on Test Server

### Option A: Using Git (Recommended)

SSH into your test server:

```bash
ssh user@your-test-server
cd /var/www/sanbox-test  # or your deployment directory
```

Then on the test server:

```bash
# Fetch the new branch
git fetch origin

# Check out the bob branch
git checkout bob

# Or if bob doesn't exist locally yet:
git checkout -b bob origin/bob

# Verify you're on bob branch
git branch
# Should show: * bob

# See what changed
git log --oneline -1
# Should show: 930e064 Phase 1: Security hardening...
```

### Option B: Using rsync (If no git remote)

From your Mac:

```bash
# Sync the bob branch to test server
rsync -avz --exclude='.git' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='node_modules' \
  --exclude='db.sqlite3' \
  /Users/rickk/sanbox/ \
  user@test-server:/var/www/sanbox-test/
```

---

## Step 3: Generate Secure SECRET_KEY (On Test Server)

```bash
# SSH into test server
ssh user@your-test-server

# Generate a secure key
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Copy the output - you'll need it in the next step
```

Example output:
```
django-insecure-abc123xyz789...
```

**Save this key!** You'll use it in the .env.test file.

---

## Step 4: Create .env.test File (On Test Server)

```bash
# On test server
cd /var/www/sanbox-test  # or your deployment directory

# Copy the template
cp .env.test.template .env.test

# Edit the file
nano .env.test  # or vim, or vi
```

Fill in these critical values:

```bash
# CRITICAL: Use the key you generated in Step 3
DJANGO_SECRET_KEY=paste-your-generated-key-here

# Database Settings - Use your actual values
POSTGRES_DB=sanbox_test_db
POSTGRES_USER=sanbox_test_user
POSTGRES_PASSWORD=your-actual-test-db-password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Your test server domain
ALLOWED_HOSTS=sanbox-test.esilabs.com,localhost,127.0.0.1

# CORS Settings
CORS_ALLOW_ALL_ORIGINS=False
CORS_ALLOWED_ORIGINS=http://sanbox-test.esilabs.com,http://localhost:3000

# CSRF Settings
CSRF_TRUSTED_ORIGINS=http://sanbox-test.esilabs.com,http://localhost:3000

# Debug (can be True for test environment)
DEBUG=False

# SSL Settings (usually False for test)
SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False
```

Save and exit (Ctrl+X, then Y, then Enter in nano).

---

## Step 5: Configure Django Settings Module

You need to tell Django to use `settings_production.py` (which now uses environment variables).

### Option A: Using systemd

Edit your systemd service file:

```bash
sudo nano /etc/systemd/system/sanbox-backend.service
```

Add or update the Environment line:

```ini
[Service]
Environment="DJANGO_SETTINGS_MODULE=sanbox.settings_production"
EnvironmentFile=/var/www/sanbox-test/.env.test
```

Reload systemd:

```bash
sudo systemctl daemon-reload
```

### Option B: Using PM2

Edit your PM2 ecosystem file:

```bash
nano ecosystem.config.js
```

Add environment variables:

```javascript
module.exports = {
  apps: [{
    name: 'sanbox-test',
    script: 'manage.py',
    args: 'runserver 0.0.0.0:8000',
    env: {
      DJANGO_SETTINGS_MODULE: 'sanbox.settings_production',
      // Load from .env.test file
    },
    env_file: '/var/www/sanbox-test/.env.test'
  }]
}
```

### Option C: Using a startup script

Edit your startup script:

```bash
nano start-sanbox.sh
```

Add these lines at the top:

```bash
#!/bin/bash
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
source /var/www/sanbox-test/.env.test

# Rest of your startup commands...
```

---

## Step 6: Test Configuration (Before Restarting)

**IMPORTANT: Test first before restarting services!**

```bash
# On test server
cd /var/www/sanbox-test/backend

# Load environment variables
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
source ../.env.test

# Run Django's deployment check
python manage.py check --deploy
```

### Expected Output (Good):

```
System check identified no issues (0 silenced).
```

### If You See Warnings:

Common warnings and how to fix them:

**Warning: SECURE_SSL_REDIRECT is False**
- This is OK for test environment without HTTPS
- Set to True if you have SSL on test server

**Warning: SECURE_HSTS_SECONDS is 0**
- This is OK for test environment
- Only needed if using HTTPS

**Error: DJANGO_SECRET_KEY must be set**
- Check that .env.test has DJANGO_SECRET_KEY
- Make sure you ran `source ../.env.test`

**Error: POSTGRES_PASSWORD must be set**
- Check that .env.test has POSTGRES_PASSWORD
- Make sure you ran `source ../.env.test`

---

## Step 7: Test Database Connection

```bash
# Still on test server with environment loaded
python manage.py migrate --check

# If that works, try connecting to database
python manage.py dbshell
# Type \q to exit
```

If this works, your database configuration is correct!

---

## Step 8: Create a Backup (Safety First!)

Before restarting services, create a backup:

```bash
# Backup database
pg_dump -U sanbox_test_user sanbox_test_db > /tmp/sanbox_test_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup current code (if not using git)
tar -czf /tmp/sanbox_test_code_backup_$(date +%Y%m%d_%H%M%S).tar.gz /var/www/sanbox-test/
```

---

## Step 9: Restart Services

### If using systemd:

```bash
# Restart backend
sudo systemctl restart sanbox-backend

# Check status
sudo systemctl status sanbox-backend

# Restart Celery workers
sudo systemctl restart sanbox-celery

# Check status
sudo systemctl status sanbox-celery
```

### If using PM2:

```bash
# Restart application
pm2 restart sanbox-test

# Check status
pm2 status

# View logs
pm2 logs sanbox-test
```

### If using manual script:

```bash
# Stop services
./stop-sanbox.sh

# Start services
./start-sanbox.sh
```

---

## Step 10: Verify Everything Works

### Check 1: Application Starts

```bash
# Check if process is running
ps aux | grep python | grep manage.py

# Check logs
tail -f /var/www/sanbox-test/logs/django.log
```

### Check 2: Web Interface

Open browser and go to your test server:
- http://sanbox-test.esilabs.com (or your test URL)

You should see the application load normally.

### Check 3: Admin Login

- Go to: http://sanbox-test.esilabs.com/admin/
- Try logging in with your admin credentials
- Should work exactly as before

### Check 4: API Endpoints

```bash
# Test health check endpoint (if you have one)
curl http://sanbox-test.esilabs.com/api/health/

# Test a known API endpoint
curl http://sanbox-test.esilabs.com/api/customers/
```

### Check 5: Database Operations

- Try creating a new record
- Try editing an existing record
- Try deleting a test record
- Verify data persists

### Check 6: Celery Tasks

```bash
# Check Celery workers are running
ps aux | grep celery

# Check Celery logs
tail -f /var/www/sanbox-test/logs/celery.log
```

---

## Step 11: Monitor for Issues

Keep an eye on logs for the first hour:

```bash
# Watch Django logs
tail -f /var/www/sanbox-test/logs/django.log

# Watch Celery logs
tail -f /var/www/sanbox-test/logs/celery.log

# Watch system logs
sudo journalctl -u sanbox-backend -f
```

---

## Rollback Plan (If Something Goes Wrong)

### Quick Rollback - Switch Back to Main Branch

```bash
# On test server
cd /var/www/sanbox-test

# Switch back to main branch
git checkout main

# Restart services
sudo systemctl restart sanbox-backend
sudo systemctl restart sanbox-celery
```

### Full Rollback - Restore from Backup

```bash
# Restore database
psql -U sanbox_test_user sanbox_test_db < /tmp/sanbox_test_backup_YYYYMMDD_HHMMSS.sql

# Restore code
cd /var/www
sudo rm -rf sanbox-test
sudo tar -xzf /tmp/sanbox_test_code_backup_YYYYMMDD_HHMMSS.tar.gz

# Restart services
sudo systemctl restart sanbox-backend
```

---

## Troubleshooting Common Issues

### Issue: "DJANGO_SECRET_KEY must be set"

**Solution:**
```bash
# Make sure environment file is loaded
source /var/www/sanbox-test/.env.test

# Verify it's set
echo $DJANGO_SECRET_KEY

# If empty, check .env.test file
cat /var/www/sanbox-test/.env.test | grep SECRET_KEY
```

### Issue: "POSTGRES_PASSWORD must be set"

**Solution:**
```bash
# Check .env.test has the password
cat /var/www/sanbox-test/.env.test | grep POSTGRES_PASSWORD

# Make sure it's loaded
source /var/www/sanbox-test/.env.test
echo $POSTGRES_PASSWORD
```

### Issue: "DisallowedHost at /"

**Solution:**
```bash
# Add your test server domain to .env.test
nano /var/www/sanbox-test/.env.test

# Update ALLOWED_HOSTS
ALLOWED_HOSTS=sanbox-test.esilabs.com,localhost,127.0.0.1

# Restart services
sudo systemctl restart sanbox-backend
```

### Issue: CORS errors in browser console

**Solution:**
```bash
# Update CORS_ALLOWED_ORIGINS in .env.test
nano /var/www/sanbox-test/.env.test

# Add your frontend URL
CORS_ALLOWED_ORIGINS=http://sanbox-test.esilabs.com,http://localhost:3000

# Restart services
sudo systemctl restart sanbox-backend
```

### Issue: Application won't start

**Check logs:**
```bash
# Django logs
tail -100 /var/www/sanbox-test/logs/django.log

# System logs
sudo journalctl -u sanbox-backend -n 100

# Check for Python errors
python manage.py check
```

---

## Post-Deployment Checklist

After successful deployment, verify:

- [ ] Application loads in browser
- [ ] Can log in to admin panel
- [ ] Can view existing data
- [ ] Can create new records
- [ ] Can edit existing records
- [ ] Can delete test records
- [ ] Celery workers are running
- [ ] Background tasks work
- [ ] No errors in logs
- [ ] API endpoints respond correctly

---

## Success Criteria

✅ **Deployment is successful if:**
1. Application starts without errors
2. All functionality works as before
3. No hardcoded secrets in code
4. Environment variables are loaded correctly
5. Logs show no critical errors

---

## Next Steps After Successful Test Deployment

1. **Monitor for 24-48 hours** - Watch for any issues
2. **Test all major features** - Import, export, SAN operations, etc.
3. **Get user feedback** - Have team test the test environment
4. **Document any issues** - Note anything that needs adjustment
5. **Plan production deployment** - Use same process for production

---

## Production Deployment (After Test Success)

Once test deployment is successful, repeat the same process for production:

1. Use `.env.production.template` instead of `.env.test.template`
2. Use production database credentials
3. Set `DEBUG=False`
4. Enable HTTPS security settings
5. Use production domain in ALLOWED_HOSTS
6. Follow the same verification steps

---

## Summary

This deployment plan ensures:
- ✅ Safe, reversible deployment
- ✅ No downtime (test environment)
- ✅ Easy rollback if needed
- ✅ Comprehensive verification
- ✅ Clear troubleshooting steps

**Estimated Time:** 30-45 minutes for careful deployment

**Risk Level:** Low (test environment, easy rollback)

Good luck with your deployment! 🚀