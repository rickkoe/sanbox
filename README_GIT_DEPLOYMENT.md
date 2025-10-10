# ✅ Git-Based Container Deployment - Complete Implementation

## Summary

Your Sanbox application now supports **git-based container deployment** that works exactly like your current workflow, but with all the benefits of containers.

## What You Asked For

> "When I deploy this in production, does it pull down from github? I currently have it so I can specify a tag to pull so the user can specify the version of the app to install. Can this do that?"

**Answer: YES!** ✅

Your familiar command:
```bash
./deploy.sh v1.2.3
```

Now becomes:
```bash
./deploy-container.sh v1.2.3
```

## Files Created

### Deployment Scripts (All Executable)

1. **[deploy-container.sh](deploy-container.sh)** ⭐ Main deployment script
   - Pulls code from GitHub by tag or branch
   - Builds Docker images on production server
   - Deploys containers with version labels
   - Runs migrations automatically
   - Saves deployment info

2. **[build-and-push.sh](build-and-push.sh)** - For registry workflows
   - Build images locally
   - Push to Docker Hub / GHCR / private registry
   - For CI/CD pipelines

3. **[deploy-container-remote.sh](deploy-container-remote.sh)** - Deploy from registry
   - Pull pre-built images from registry
   - Fast deployment (no build time on server)
   - Deploy same images to multiple servers

4. **[rollback.sh](rollback.sh)** - Quick version rollback
   - Lists available versions
   - Rollback to any previous deployment
   - Optional database backup
   - Health verification

### Documentation

5. **[GIT_DEPLOYMENT_SUMMARY.md](GIT_DEPLOYMENT_SUMMARY.md)** - High-level overview
6. **[DEPLOYMENT_WORKFLOWS.md](DEPLOYMENT_WORKFLOWS.md)** - Detailed workflows
7. **[DOCKER.md](DOCKER.md)** - Updated with deployment strategies
8. **[CONTAINER_QUICKSTART.md](CONTAINER_QUICKSTART.md)** - Updated with git deployment

### Configuration Updates

9. **[docker-compose.yml](docker-compose.yml)** - Now supports VERSION variable

## How It Works

### Deployment Flow (Just Like Your Current Setup!)

```bash
# Deploy specific tagged version
./deploy-container.sh v1.2.3
```

**Behind the scenes**:
1. ✅ Pulls `v1.2.3` tag from your GitHub repo
2. ✅ Builds Docker images with that code
3. ✅ Tags images as `sanbox-backend:v1.2.3`
4. ✅ Stops old containers
5. ✅ Starts new containers
6. ✅ Runs database migrations
7. ✅ Saves deployment info

### Deploy Latest

```bash
# Deploy latest from main branch
./deploy-container.sh
```

### Rollback

```bash
# Rollback to previous version
./rollback.sh v1.2.2
```

## Setup (5 Minutes)

### On Production Server

1. **Edit deployment script** (one time only):
   ```bash
   nano deploy-container.sh
   ```

   Update this line:
   ```bash
   REPO_URL="https://github.com/your-org/sanbox.git"
   ```

2. **First deployment**:
   ```bash
   ./deploy-container.sh v1.0.0
   ```

That's it! Now you can deploy any version by tag.

## Deployment Examples

### Production Release

```bash
# Create and push git tag
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin v1.2.3

# SSH to production server
ssh user@production-server

# Deploy that version
cd /var/www/sanbox
./deploy-container.sh v1.2.3

# Verify
cat deployment-info.txt
docker-compose ps
```

### Hotfix Deployment

```bash
# Create hotfix tag
git tag -a v1.2.4 -m "Hotfix for bug #123"
git push origin v1.2.4

# Deploy immediately
ssh user@production-server "cd /var/www/sanbox && ./deploy-container.sh v1.2.4"
```

### Rollback After Bad Deploy

```bash
# Something went wrong with v1.2.4
./rollback.sh v1.2.3

# Or interactive mode
./rollback.sh
# Then select v1.2.3 from list
```

## Comparison: Before vs After

| Feature | Old Setup | Container Setup |
|---------|-----------|-----------------|
| Command | `./deploy.sh v1.2.3` | `./deploy-container.sh v1.2.3` |
| Pull from GitHub | ✅ | ✅ |
| Version tagging | ✅ | ✅ |
| Run migrations | ✅ | ✅ |
| Dependencies | ⚠️ Manual pip/npm | ✅ Automatic |
| Rollback | ❌ Not supported | ✅ `./rollback.sh` |
| Version tracking | ⚠️ Manual | ✅ Automatic |
| Consistency | ⚠️ Varies | ✅ Identical |
| Multiple servers | ⚠️ Rebuild each | ✅ Can use registry |

## Bonus: Registry-Based Workflow

For even faster deployments across multiple servers:

### Build Once, Deploy Many Times

**On your dev machine**:
```bash
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox
```

**On production servers** (fast - no build!):
```bash
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox
```

Benefits:
- Build once, deploy to unlimited servers
- No build time on production
- Perfect for CI/CD
- Consistent images everywhere

## What Gets Deployed

When you run `./deploy-container.sh v1.2.3`:

```
┌────────────────────────────────────────┐
│ Your GitHub Repository                 │
│  └─ Tag: v1.2.3                        │
└────────────────────────────────────────┘
              ↓ (git clone/checkout)
┌────────────────────────────────────────┐
│ Production Server Build Directory      │
│  /var/www/sanbox_build                 │
└────────────────────────────────────────┘
              ↓ (docker build)
┌────────────────────────────────────────┐
│ Docker Images                          │
│  • sanbox-backend:v1.2.3              │
│  • sanbox-frontend:v1.2.3             │
│  • sanbox-nginx:v1.2.3                │
└────────────────────────────────────────┘
              ↓ (docker-compose up)
┌────────────────────────────────────────┐
│ Running Containers                     │
│  • Backend (Django + Gunicorn)        │
│  • Frontend (React + Nginx)           │
│  • Celery Worker                       │
│  • Celery Beat                         │
│  • PostgreSQL                          │
│  • Redis                               │
└────────────────────────────────────────┘
```

## Deployment Info Tracking

Every deployment creates/updates `/var/www/sanbox/deployment-info.txt`:

```
Deployment Information
=====================
Version: v1.2.3
Commit: a1b2c3d
Build Date: 2025-01-10T15:30:00Z
Deployed: Fri Jan 10 15:30:00 UTC 2025
Deployed By: admin
```

Check current version anytime:
```bash
cat /var/www/sanbox/deployment-info.txt
```

## Version Management

### List Deployed Versions

```bash
# See all versions available for rollback
docker images sanbox-backend --format "table {{.Tag}}\t{{.CreatedAt}}"
```

Output:
```
TAG         CREATED
v1.2.3      2025-01-10 15:30:00
v1.2.2      2025-01-09 10:15:00
v1.2.1      2025-01-08 14:20:00
latest      2025-01-10 15:30:00
```

### Clean Old Versions

```bash
# Remove specific version
docker rmi sanbox-backend:v1.2.1

# Keep only recent versions
docker images sanbox-backend --format "{{.Tag}}" | tail -n +4 | xargs -I {} docker rmi sanbox-backend:{}
```

## Monitoring Deployments

### Real-time Deployment Logs

During deployment, monitor in real-time:
```bash
# In another terminal
docker-compose logs -f backend
```

### Health Checks

The deployment scripts automatically check:
- ✅ PostgreSQL readiness
- ✅ Django application health
- ✅ Database migrations status
- ✅ Static files collection

### Post-Deployment Verification

```bash
# Service status
docker-compose ps

# Recent logs
docker-compose logs --tail=50 backend

# Django check
docker-compose exec backend python manage.py check --deploy

# Database status
docker-compose exec postgres pg_isready
```

## Troubleshooting

### Deployment Fails

```bash
# Check logs
docker-compose logs backend

# Check Docker space
docker system df

# Clean if needed
docker system prune -a
```

### Migration Issues

```bash
# Check migration status
docker-compose exec backend python manage.py showmigrations

# Try manually
docker-compose exec backend python manage.py migrate --verbosity 3
```

### Rollback Not Working

```bash
# Force stop containers
docker-compose down -v

# Start with specific version
VERSION=v1.2.2 docker-compose up -d
```

## Best Practices

1. ✅ **Always use version tags** for production
2. ✅ **Test in staging first** before production
3. ✅ **Backup database** before major upgrades
4. ✅ **Monitor logs** during deployment
5. ✅ **Keep 3-5 old versions** for quick rollback
6. ✅ **Document deployments** in deployment-info.txt
7. ✅ **Use semantic versioning** (v1.2.3)

## Quick Command Reference

```bash
# Deploy specific version (git-based)
./deploy-container.sh v1.2.3

# Deploy latest from main
./deploy-container.sh

# Rollback to previous version
./rollback.sh v1.2.2

# Build and push to registry
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox

# Deploy from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox

# Check deployed version
cat /var/www/sanbox/deployment-info.txt

# List available versions
docker images sanbox-backend

# View logs
docker-compose logs -f backend

# Check status
docker-compose ps

# Stop services
docker-compose down

# Start services
docker-compose up -d
```

## Documentation

- **This File**: Quick overview and examples
- **[GIT_DEPLOYMENT_SUMMARY.md](GIT_DEPLOYMENT_SUMMARY.md)**: Detailed comparison and benefits
- **[DEPLOYMENT_WORKFLOWS.md](DEPLOYMENT_WORKFLOWS.md)**: Complete deployment workflows
- **[DOCKER.md](DOCKER.md)**: Full Docker documentation
- **[CONTAINER_QUICKSTART.md](CONTAINER_QUICKSTART.md)**: Quick reference

## Summary

✅ **Git-based deployment**: Just like your current `deploy.sh`
✅ **Version tagging**: Deploy any git tag
✅ **Quick rollback**: Single command to rollback
✅ **Container benefits**: Consistency, isolation, portability
✅ **Multiple strategies**: Git-based, registry-based, or local build
✅ **Fully documented**: Step-by-step guides included

**Your familiar workflow now works with containers!** 🎉

---

**Next Steps:**
1. Update `REPO_URL` in [deploy-container.sh](deploy-container.sh)
2. Test in staging: `./deploy-container.sh v1.0.0`
3. Deploy to production when ready!
