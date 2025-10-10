# Git-Based Container Deployment - Summary

## Overview

Your Sanbox application now supports **git-based container deployment** that maintains your familiar workflow:

**Before** (non-containerized):
```bash
./deploy.sh v1.2.3
```

**Now** (containerized):
```bash
./deploy-container.sh v1.2.3
```

## What Was Added

### New Deployment Scripts

1. **[deploy-container.sh](deploy-container.sh)** - Main deployment script
   - Pulls specific version from GitHub
   - Builds Docker images on server
   - Deploys containers with version tagging
   - Runs migrations automatically
   - Just like your current `deploy.sh` but with containers!

2. **[build-and-push.sh](build-and-push.sh)** - Build and push to registry
   - Build images locally
   - Tag with version
   - Push to Docker Hub, GHCR, or private registry
   - For CI/CD workflows

3. **[deploy-container-remote.sh](deploy-container-remote.sh)** - Deploy from registry
   - Pull pre-built images from registry
   - Fast deployment (no build time)
   - Deploy same images to multiple servers

4. **[rollback.sh](rollback.sh)** - Quick rollback
   - List available versions
   - Rollback to any previous version
   - Optional database backup
   - Verify health after rollback

### Updated Files

5. **[docker-compose.yml](docker-compose.yml)** - Now supports version tags
   - Uses `VERSION` environment variable
   - Can deploy any tagged version
   - Defaults to `latest` if not specified

6. **[DOCKER.md](DOCKER.md)** - Updated documentation
   - Three deployment strategies explained
   - Step-by-step deployment workflows
   - Registry setup instructions

7. **[DEPLOYMENT_WORKFLOWS.md](DEPLOYMENT_WORKFLOWS.md)** - NEW comprehensive guide
   - Detailed workflows for each strategy
   - Version management
   - Database handling
   - Troubleshooting
   - Best practices

## How It Works

### Git-Based Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. You run: ./deploy-container.sh v1.2.3               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Script pulls v1.2.3 from GitHub                     │
│    → git fetch && git checkout tags/v1.2.3             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Builds Docker images                                │
│    → sanbox-backend:v1.2.3                             │
│    → sanbox-frontend:v1.2.3                            │
│    → sanbox-nginx:v1.2.3                               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Stops old containers gracefully                     │
│    → docker-compose down --timeout 30                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Starts new containers                               │
│    → docker-compose up -d                              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Runs migrations                                      │
│    → docker-compose exec backend python manage.py      │
│      migrate                                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Health checks & deployment info saved               │
│    → deployment-info.txt with version details          │
└─────────────────────────────────────────────────────────┘
```

## Usage Examples

### Deploy Production Release

```bash
# SSH to production server
ssh user@production-server

# Deploy version 1.2.3
cd /var/www/sanbox
./deploy-container.sh v1.2.3

# Check deployment
cat deployment-info.txt
docker-compose ps
```

### Deploy Latest Development

```bash
./deploy-container.sh
# Uses latest code from main branch
```

### Rollback After Bad Deploy

```bash
# See available versions
./rollback.sh

# Or directly rollback
./rollback.sh v1.2.2
```

### Check Current Version

```bash
# View deployment info
cat /var/www/sanbox/deployment-info.txt

# See running images
docker-compose images
```

## Setup Requirements

### One-Time Setup on Production Server

1. **Install Docker and Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Configure deployment script**
   ```bash
   # Edit deploy-container.sh
   nano deploy-container.sh

   # Update this line:
   REPO_URL="https://github.com/your-org/sanbox.git"
   ```

3. **Create .env file**
   ```bash
   cp .env.example /var/www/sanbox/.env
   nano /var/www/sanbox/.env
   # Set production values
   ```

4. **First deployment**
   ```bash
   ./deploy-container.sh v1.0.0
   ```

## Comparison with Current Workflow

| Feature | Old `deploy.sh` | New `deploy-container.sh` |
|---------|-----------------|---------------------------|
| Pull from GitHub | ✅ Yes | ✅ Yes |
| Version tagging | ✅ Yes | ✅ Yes |
| Deploy by tag | ✅ `./deploy.sh v1.2.3` | ✅ `./deploy-container.sh v1.2.3` |
| Install dependencies | ⚠️ pip/npm | ✅ Automatic (in images) |
| Run migrations | ✅ Yes | ✅ Yes |
| PM2 process management | ✅ Yes | ⚠️ Docker instead |
| Rollback support | ❌ Manual | ✅ `./rollback.sh` |
| Multiple servers | ⚠️ Build each | ✅ Can use registry |
| Consistency | ⚠️ Varies by server | ✅ Identical everywhere |

## Alternative: Registry-Based Deployment

For deploying to multiple servers or CI/CD:

### On Development Machine (or CI)

```bash
# Build and push tagged version
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox
```

### On Production Server(s)

```bash
# Fast deployment from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox
```

**Benefits**:
- Build once, deploy many times
- Fast (no build time on server)
- Consistent images across all servers
- Good for multiple environments

## Benefits of Container Deployment

1. **Consistency**: Exact same environment everywhere
2. **Rollback**: Quick rollback to any version
3. **Isolation**: Each service in its own container
4. **Portability**: Deploy on any server with Docker
5. **Version Control**: Track deployed versions easily
6. **Scaling**: Easy to scale individual services
7. **Dependencies**: All dependencies included in images

## Directory Structure

```
/var/www/
├── sanbox/                    # Production deployment
│   ├── docker-compose.yml
│   ├── .env
│   ├── logs/
│   └── deployment-info.txt
└── sanbox_build/              # Build directory (git clone)
    ├── backend/
    ├── frontend/
    ├── nginx/
    ├── deploy-container.sh
    └── .git/
```

## Troubleshooting

### Deployment Fails

```bash
# Check logs
docker-compose logs

# Check Docker space
docker system df

# Clean if needed
docker system prune
```

### Wrong Version Deployed

```bash
# Check current version
docker-compose images

# Rollback
./rollback.sh <correct-version>
```

### Database Issues

```bash
# Check database
docker-compose exec postgres pg_isready

# Check migrations
docker-compose exec backend python manage.py showmigrations

# View backend logs
docker-compose logs backend
```

## Next Steps

1. ✅ Review [DEPLOYMENT_WORKFLOWS.md](DEPLOYMENT_WORKFLOWS.md) for detailed workflows
2. ✅ Update `REPO_URL` in [deploy-container.sh](deploy-container.sh)
3. ✅ Test deployment in staging environment first
4. ✅ Create git tags for your releases
5. ✅ Deploy to production with `./deploy-container.sh v1.0.0`

## Quick Command Reference

```bash
# Deploy specific version
./deploy-container.sh v1.2.3

# Deploy latest
./deploy-container.sh

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

# Check status
docker-compose ps

# List available versions
docker images sanbox-backend
```

## Support

- **Detailed Guide**: [DEPLOYMENT_WORKFLOWS.md](DEPLOYMENT_WORKFLOWS.md)
- **Docker Guide**: [DOCKER.md](DOCKER.md)
- **Quick Start**: [CONTAINER_QUICKSTART.md](CONTAINER_QUICKSTART.md)
- **Main README**: [README.md](README.md)

---

**Your familiar git-based deployment workflow now works with containers!** 🎉
