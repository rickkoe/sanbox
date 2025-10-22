# Production Deployment - Quick Start Guide

## Quick Commands

### 1. Export Equipment Types from Dev

```bash
./scripts/export-equipment-types.sh
```

This creates `equipment_types_fixture.json` with your current equipment types.

### 2. Deploy to Production

**Option A: Using deployment script (recommended)**

```bash
# Commit and tag your code
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags

# On production server
./deploy-container.sh v1.0.0
```

**Option B: Manual deployment**

```bash
# On production server
git pull origin main
docker-compose down
docker-compose up -d --build
docker-compose exec backend python manage.py migrate
```

### 3. Import Equipment Types to Production

```bash
# Copy fixture to production server
scp equipment_types_fixture.json user@prod-server:/path/to/sanbox/

# On production server
./scripts/import-equipment-types.sh
```

### 4. Setup HTTPS (One-time)

**For public servers:**
```bash
sudo ./setup-ssl.sh your-domain.com your-email@example.com
```

**For internal/VPN servers:**
```bash
sudo ./setup-ssl-selfsigned.sh your-internal-domain.com
```

## Verification Checklist

After deployment:

- [ ] Containers are running: `docker ps`
- [ ] No errors in logs: `docker-compose logs backend`
- [ ] Website loads: `https://your-domain.com`
- [ ] Can login to admin: `https://your-domain.com/admin/`
- [ ] Equipment types present: Check admin > Core > Equipment types
- [ ] Worksheet generator works: Test creating a worksheet

## Equipment Types Included

The fixture includes these 5 equipment types:

1. **SAN Switch - Cisco** (network)
2. **SAN Switch - Brocade** (network)
3. **IBM FlashSystem** (storage)
4. **IBM DS8000** (storage)
5. **Server** (compute)

## Rollback

If something goes wrong:

```bash
# Rollback to previous version
./rollback.sh v0.9.0

# Or restore equipment types from backup
./scripts/import-equipment-types.sh equipment_types_backup_20251021.json
```

## Need Help?

- Full guide: See `PRODUCTION_DEPLOYMENT.md`
- Troubleshooting: Check `docker-compose logs backend`
- Equipment types: See `equipment_types_fixture.json`
