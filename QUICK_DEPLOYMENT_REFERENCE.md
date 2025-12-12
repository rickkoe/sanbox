# Quick Deployment Reference Card

## 🚀 Deploy to Test Server - Quick Steps

### 1. Push bob branch (On Mac)
```bash
git push origin bob
```

### 2. Pull on test server
```bash
ssh user@test-server
cd /var/www/sanbox-test
git fetch origin
git checkout bob
```

### 3. Generate SECRET_KEY
```bash
python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 4. Create .env.test
```bash
cp .env.test.template .env.test
nano .env.test
# Fill in: DJANGO_SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_HOSTS
```

### 5. Test configuration
```bash
export DJANGO_SETTINGS_MODULE=sanbox.settings_production
source .env.test
python manage.py check --deploy
```

### 6. Restart services
```bash
sudo systemctl restart sanbox-backend
sudo systemctl restart sanbox-celery
```

### 7. Verify
- Open browser: http://your-test-server
- Check logs: `tail -f logs/django.log`
- Test login and basic operations

---

## 🔄 Rollback (If Needed)
```bash
git checkout main
sudo systemctl restart sanbox-backend
```

---

## 📋 Key Files Changed

### Modified:
- `backend/sanbox/settings_production.py` - Now uses environment variables
- `backend/sanbox/settings.py` - Added documentation
- `.env.production.template` - Updated

### New:
- `.env.test.template` - Test environment config
- `TEST_SERVER_DEPLOYMENT_PLAN.md` - Detailed deployment guide
- Multiple documentation files

---

## ⚠️ Critical Environment Variables

Must be set in `.env.test`:
```bash
DJANGO_SECRET_KEY=<generate-new-key>
POSTGRES_PASSWORD=<your-db-password>
ALLOWED_HOSTS=your-test-domain.com,localhost
CORS_ALLOWED_ORIGINS=http://your-test-domain.com
CSRF_TRUSTED_ORIGINS=http://your-test-domain.com
```

---

## 🆘 Quick Troubleshooting

**Error: "DJANGO_SECRET_KEY must be set"**
```bash
source .env.test
echo $DJANGO_SECRET_KEY  # Should show your key
```

**Error: "DisallowedHost"**
```bash
# Add your domain to ALLOWED_HOSTS in .env.test
nano .env.test
```

**Application won't start**
```bash
tail -100 logs/django.log
sudo journalctl -u sanbox-backend -n 100
```

---

## 📚 Full Documentation

- **TEST_SERVER_DEPLOYMENT_PLAN.md** - Complete step-by-step guide (619 lines)
- **DEPLOYMENT_GUIDE.md** - General deployment guide
- **SECURITY_FIXES_SUMMARY.md** - What changed and why

---

## ✅ Success Checklist

- [ ] Application starts without errors
- [ ] Can access web interface
- [ ] Can log in to admin
- [ ] Database operations work
- [ ] Celery workers running
- [ ] No errors in logs

---

## 📞 Need Help?

See **TEST_SERVER_DEPLOYMENT_PLAN.md** for:
- Detailed troubleshooting
- Common issues and solutions
- Rollback procedures
- Verification steps

---

**Estimated Time:** 30-45 minutes
**Risk Level:** Low (easy rollback available)