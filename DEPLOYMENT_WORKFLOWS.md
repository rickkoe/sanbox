# Sanbox Container Deployment Workflows

This guide provides detailed workflows for deploying Sanbox containers with git-based version control.

## Overview

Three deployment strategies are available:

1. **Git-Based** - Pull from GitHub, build on server (like current workflow)
2. **Registry-Based** - Build locally/CI, push to registry, deploy from registry
3. **Local Build** - Simple local build and deploy

## Workflow 1: Git-Based Deployment (Recommended)

**Use case**: Maintains your existing `./deploy.sh v1.2.3` workflow with containers.

### Setup (One Time)

1. Edit `deploy-container.sh` and set your GitHub repository:
   ```bash
   REPO_URL="https://github.com/your-org/sanbox.git"
   ```

2. Ensure server has Docker and Docker Compose installed

3. Create initial `.env` file on server:
   ```bash
   cp .env.example /var/www/sanbox/.env
   # Edit with production values
   ```

### Deploy Specific Version

```bash
# SSH to production server
ssh user@production-server

# Deploy tagged version
cd /path/to/sanbox
./deploy-container.sh v1.2.3
```

**What happens**:
1. Clones/pulls code from GitHub to `/var/www/sanbox_build`
2. Checks out git tag `v1.2.3`
3. Builds Docker images:
   - `sanbox-backend:v1.2.3`
   - `sanbox-frontend:v1.2.3`
   - `sanbox-nginx:v1.2.3`
4. Tags images as `:latest` too
5. Stops old containers
6. Starts new containers
7. Runs migrations
8. Saves deployment info

### Deploy Latest from Main

```bash
./deploy-container.sh
```

Uses latest code from main branch instead of a specific tag.

### Rollback

```bash
# Interactive - shows available versions
./rollback.sh

# Direct - specify version
./rollback.sh v1.2.2
```

**Features**:
- Lists available image versions
- Optional database backup before rollback
- Switches containers to previous version
- Runs migrations
- Updates deployment info

## Workflow 2: Registry-Based Deployment

**Use case**: Build images once, deploy to multiple servers. Good for CI/CD.

### Setup (One Time)

#### 1. Choose a Registry

**GitHub Container Registry (GHCR)**:
- Free for public repos
- Private for organization repos
- URL: `ghcr.io/your-org/sanbox`

**Docker Hub**:
- Free tier available
- URL: `docker.io/your-org/sanbox`

**Private Registry**:
- Your own registry
- URL: `registry.yourcompany.com/sanbox`

#### 2. Authenticate

```bash
# On your dev machine and production server

# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Docker Hub
docker login

# Private registry
docker login registry.yourcompany.com
```

**Creating GitHub Personal Access Token**:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `write:packages`, `read:packages`, `delete:packages`
4. Copy token and use as `$GITHUB_TOKEN`

### Build and Push Images

**On your development machine**:

```bash
# Build and push version v1.2.3 to GitHub Container Registry
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox
```

**What happens**:
1. Prompts to checkout git tag `v1.2.3`
2. Builds images with version labels
3. Tags as `ghcr.io/your-org/sanbox/backend:v1.2.3`
4. Prompts to push to registry
5. Pushes all images

**Automation with CI/CD**:

```yaml
# Example GitHub Actions workflow (.github/workflows/build.yml)
name: Build and Push

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to GHCR
        run: echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin

      - name: Build and Push
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          ./build-and-push.sh $VERSION ghcr.io/${{ github.repository_owner }}/sanbox
```

### Deploy from Registry

**On production server**:

```bash
# Deploy version v1.2.3 from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox
```

**What happens**:
1. Pulls images from registry
2. Tags locally for docker-compose
3. Stops old containers
4. Starts new containers
5. Runs migrations
6. Saves deployment info

**Benefits**:
- Fast deployment (no build time on server)
- Consistent images across environments
- Can deploy to multiple servers quickly
- Build once, deploy many times

## Workflow 3: Local Build Deployment

**Use case**: Simple deployment without git/registry integration.

### Build Locally

```bash
# Build images from current code
./build.sh production
```

This uses whatever code is currently in your working directory.

### Deploy

```bash
# Deploy using docker-compose
docker-compose up -d
```

Or manually tag for specific version:

```bash
# Tag current images as a version
docker tag sanbox-backend:latest sanbox-backend:v1.2.3
docker tag sanbox-frontend:latest sanbox-frontend:v1.2.3
docker tag sanbox-nginx:latest sanbox-nginx:v1.2.3

# Then use rollback script to "deploy" that version
./rollback.sh v1.2.3
```

## Deployment Comparison

| Feature | Git-Based | Registry-Based | Local Build |
|---------|-----------|----------------|-------------|
| Like current workflow | ✅ Yes | ❌ No | ⚠️ Partial |
| Version tagging | ✅ Automatic | ✅ Automatic | ⚠️ Manual |
| Build time on server | ⚠️ Required | ✅ None | ⚠️ Required |
| Multiple servers | ⚠️ Build each | ✅ Easy | ❌ Hard |
| CI/CD ready | ⚠️ Needs work | ✅ Yes | ❌ No |
| Simplicity | ✅ High | ⚠️ Medium | ✅ High |

## Version Management

### Tagging Releases

```bash
# Create and push git tag
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# Deploy that tag
./deploy-container.sh v1.2.3
```

### Listing Deployed Versions

```bash
# On production server
docker images sanbox-backend --format "table {{.Tag}}\t{{.CreatedAt}}"
```

### Checking Current Version

```bash
# View deployment info
cat /var/www/sanbox/deployment-info.txt

# Check running containers
docker-compose ps
docker-compose images
```

### Cleaning Old Versions

```bash
# List all images
docker images sanbox-backend

# Remove specific version
docker rmi sanbox-backend:v1.2.1

# Remove unused images (keeps ones in use)
docker image prune -a --filter "label=app=sanbox"
```

## Database Management During Deployments

### Automatic Migrations

All deployment scripts automatically run:
```bash
docker-compose exec backend python manage.py migrate
```

### Manual Migrations

```bash
# Create migrations
docker-compose exec backend python manage.py makemigrations

# Apply migrations
docker-compose exec backend python manage.py migrate

# Check migration status
docker-compose exec backend python manage.py showmigrations
```

### Database Backup Before Deployment

```bash
# Manual backup
docker-compose exec postgres pg_dump -U sanbox_user sanbox_db > backup_$(date +%Y%m%d).sql

# Rollback script automatically offers to backup
./rollback.sh  # Will prompt for backup
```

### Restore Database

```bash
# Restore from backup
cat backup_20250110.sql | docker-compose exec -T postgres psql -U sanbox_user -d sanbox_db
```

## Deployment Checklist

### Before Deployment

- [ ] Code tested locally
- [ ] Database migrations tested
- [ ] Git tag created (if using version)
- [ ] `.env` file configured on server
- [ ] Database backed up
- [ ] Deployment window scheduled (if needed)

### During Deployment

- [ ] Run deployment script
- [ ] Monitor logs for errors
- [ ] Verify migrations complete
- [ ] Check service health
- [ ] Test key functionality

### After Deployment

- [ ] Verify application accessible
- [ ] Check all services running
- [ ] Review logs for errors
- [ ] Test critical workflows
- [ ] Update deployment documentation
- [ ] Notify team of deployment

## Troubleshooting Deployments

### Deployment Fails to Build

```bash
# Check Docker space
docker system df

# Clean up if needed
docker system prune -a

# Check build logs
docker-compose build --no-cache backend
```

### Containers Won't Start

```bash
# Check logs
docker-compose logs backend

# Check service dependencies
docker-compose ps

# Verify environment variables
docker-compose config
```

### Database Migration Fails

```bash
# Check migration status
docker-compose exec backend python manage.py showmigrations

# Try manually
docker-compose exec backend python manage.py migrate --verbosity 3

# Rollback if needed
./rollback.sh <previous-version>
```

### Wrong Version Deployed

```bash
# Check current images
docker-compose images

# Rollback
./rollback.sh <correct-version>
```

## Monitoring Deployments

### Real-time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Multiple services
docker-compose logs -f backend celery-worker
```

### Health Checks

```bash
# Check service status
docker-compose ps

# Backend health
docker-compose exec backend python manage.py check --deploy

# Database health
docker-compose exec postgres pg_isready

# Redis health
docker-compose exec redis redis-cli ping
```

### Resource Usage

```bash
# Container stats
docker stats

# Disk usage
docker system df

# Service-specific
docker stats sanbox_backend sanbox_postgres
```

## Best Practices

1. **Always use version tags** for production deployments
2. **Backup database** before major version upgrades
3. **Test migrations** in staging environment first
4. **Monitor logs** during and after deployment
5. **Keep old versions** available for quick rollback
6. **Document deployments** in deployment-info.txt
7. **Use registry** for deploying to multiple servers
8. **Automate builds** with CI/CD when possible

## Quick Reference

```bash
# Deploy specific version (git-based)
./deploy-container.sh v1.2.3

# Build and push to registry
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox

# Deploy from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox

# Rollback
./rollback.sh v1.2.2

# Check version
cat /var/www/sanbox/deployment-info.txt

# View logs
docker-compose logs -f backend

# Service status
docker-compose ps
```
