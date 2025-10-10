# Docker Deployment Guide for Sanbox

This guide covers running Sanbox in Docker containers for development and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start - Development](#quick-start---development)
- [Quick Start - Production](#quick-start---production)
- [Architecture](#architecture)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Migration from Non-Containerized Setup](#migration-from-non-containerized-setup)

## Prerequisites

- **Docker Desktop** (Mac/Windows) or **Docker Engine** (Linux)
  - Version 20.10 or higher recommended
  - Docker Compose V2 (included with Docker Desktop)
- **Minimum System Requirements**:
  - 8GB RAM (16GB recommended)
  - 20GB free disk space
  - Multi-core CPU recommended

### Installation

**macOS**:
```bash
# Install Docker Desktop from https://www.docker.com/products/docker-desktop
# Or use Homebrew:
brew install --cask docker
```

**Linux**:
```bash
# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Windows**:
- Download and install Docker Desktop from https://www.docker.com/products/docker-desktop

## Quick Start - Development

### 1. Start Development Environment

```bash
# Start all services with hot-reload
./dev-up.sh
```

This will:
- Build Docker images (first run only)
- Start PostgreSQL, Redis, Django, Celery, and React
- Run database migrations
- Prompt to create a superuser

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

### 3. Make Code Changes

Edit files in `./backend/` or `./frontend/src/` - changes will auto-reload!

### 4. Stop Development Environment

```bash
./dev-down.sh
```

## Quick Start - Production

### 1. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your production settings
nano .env
```

**Required changes**:
- `DJANGO_SECRET_KEY`: Generate a new secret key
- `POSTGRES_PASSWORD`: Set a secure password
- `ALLOWED_HOSTS`: Add your domain
- `CSRF_TRUSTED_ORIGINS`: Add your domain with https://
- Set `DEBUG=False`

### 2. Build Production Images

```bash
./build.sh production
```

### 3. Start Production Environment

```bash
docker-compose up -d
```

### 4. Run Initial Setup

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Collect static files (should be done automatically)
docker-compose exec backend python manage.py collectstatic --noinput
```

### 5. Access the Application

- **Application**: http://localhost (or your domain)
- **Admin**: http://localhost/admin/

## Architecture

### Container Services

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │PostgreSQL│  │  Redis   │  │  Django  │  │   Celery     │  │
│  │ (5432)   │  │  (6379)  │  │  (8000)  │  │ Worker/Beat  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│       │             │              │               │           │
│       └─────────────┴──────────────┴───────────────┘           │
│                          │                                      │
│  ┌──────────┐      ┌──────────┐                               │
│  │  React   │      │  Nginx   │                               │
│  │  (3000)  │      │  (80)    │  ← Production only            │
│  └──────────┘      └──────────┘                               │
│       │                  │                                      │
└───────┼──────────────────┼──────────────────────────────────────┘
        │                  │
        └─────── Public Access ──────┘
      (Dev: 3000)    (Prod: 80)
```

### Volume Mounts

**Development**:
- Source code mounted for hot-reload
- Separate volumes for database and cache data

**Production**:
- Code baked into images
- Persistent volumes for database, media, and static files

## Development Workflow

### Working with the Backend

```bash
# Django shell
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

# Create migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# Run migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Run tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Django management commands
docker-compose -f docker-compose.dev.yml exec backend python manage.py <command>
```

### Working with the Frontend

```bash
# Access frontend container shell
docker-compose -f docker-compose.dev.yml exec frontend sh

# Install npm package
docker-compose -f docker-compose.dev.yml exec frontend npm install <package>

# Run npm commands
docker-compose -f docker-compose.dev.yml exec frontend npm run <script>
```

### Working with the Database

```bash
# PostgreSQL shell
docker-compose -f docker-compose.dev.yml exec postgres psql -U sanbox_dev -d sanbox_dev

# Backup database
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U sanbox_dev sanbox_dev > backup.sql

# Restore database
cat backup.sql | docker-compose -f docker-compose.dev.yml exec -T postgres psql -U sanbox_dev -d sanbox_dev
```

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f celery-worker

# Last 100 lines
docker-compose -f docker-compose.dev.yml logs --tail=100 backend
```

### Debugging

**Backend (Django)**:
```bash
# Attach to running container for pdb debugging
docker-compose -f docker-compose.dev.yml up
# In another terminal:
docker attach sanbox_dev_backend
# Set breakpoint in code: import pdb; pdb.set_trace()
```

**Frontend (React)**:
- Source maps are enabled in development
- Use browser DevTools as usual
- React DevTools extension works normally

## Production Deployment

Sanbox supports multiple production deployment strategies to match your workflow.

### Strategy 1: Git-Based Deployment (Recommended)

**Maintains your existing workflow**: Pull code from GitHub and deploy specific versions by tag.

#### Deploy from GitHub Repository

```bash
# On production server - deploy specific version
./deploy-container.sh v1.2.3

# Or deploy latest from main branch
./deploy-container.sh
```

This script will:
1. Pull specified version/tag from GitHub
2. Build Docker images on the server
3. Stop old containers gracefully
4. Start new containers with version labels
5. Run database migrations
6. Verify deployment health

**First time setup**:
Edit `deploy-container.sh` and update:
```bash
REPO_URL="https://github.com/your-org/sanbox.git"  # Your GitHub repo
```

**Usage examples**:
```bash
# Deploy production release
./deploy-container.sh v1.2.3

# Deploy latest development
./deploy-container.sh

# View deployment info
cat /var/www/sanbox/deployment-info.txt
```

#### Rollback to Previous Version

```bash
# Interactive mode - shows available versions
./rollback.sh

# Direct rollback to specific version
./rollback.sh v1.2.2
```

The rollback script will:
- Optionally backup database before rollback
- Switch containers to previous version
- Run migrations (if needed)
- Verify health

### Strategy 2: Registry-Based Deployment

**For CI/CD pipelines**: Build once, deploy everywhere.

#### On Development Machine

```bash
# Build and push to registry
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox

# This will:
# 1. Checkout git tag v1.2.3
# 2. Build all images
# 3. Push to GitHub Container Registry (or Docker Hub, etc.)
```

#### On Production Server

```bash
# Pull and deploy from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox
```

**Registry Options**:
- GitHub Container Registry: `ghcr.io/your-org/sanbox`
- Docker Hub: `docker.io/your-org/sanbox`
- Private Registry: `registry.yourcompany.com/sanbox`

**Authentication**:
```bash
# GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Docker Hub
docker login

# Private registry
docker login registry.yourcompany.com
```

### Strategy 3: Local Build Deployment

**Simple approach**: Build locally without git integration.

### Building for Production

```bash
# Build all production images
./build.sh production

# Build specific version
VERSION=1.0.0 ./build.sh production

# Tag for registry
docker tag sanbox-backend:latest your-registry.com/sanbox-backend:1.0.0
docker tag sanbox-frontend:latest your-registry.com/sanbox-frontend:1.0.0
docker tag sanbox-nginx:latest your-registry.com/sanbox-nginx:1.0.0
```

### Deploying to Production Server

**On your build machine**:
```bash
# Build and push images
./build.sh production
docker push your-registry.com/sanbox-backend:latest
docker push your-registry.com/sanbox-frontend:latest
docker push your-registry.com/sanbox-nginx:latest
```

**On production server**:
```bash
# Pull images
docker pull your-registry.com/sanbox-backend:latest
docker pull your-registry.com/sanbox-frontend:latest
docker pull your-registry.com/sanbox-nginx:latest

# Start services
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

### SSL/TLS Configuration

To enable HTTPS in production:

1. Update `nginx/nginx.conf` to include SSL configuration
2. Mount SSL certificates as volumes
3. Update `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "443:443"
  volumes:
    - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
    - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro
```

## Environment Variables

### Development (.env.dev)

Pre-configured with safe defaults for local development.

### Production (.env)

**Critical variables to configure**:

```bash
# Security
DJANGO_SECRET_KEY=<generate-a-unique-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
POSTGRES_PASSWORD=<secure-password>

# CSRF/CORS
CSRF_TRUSTED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Cookies (for HTTPS)
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

**Generate Django secret key**:
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

See [.env.example](.env.example) for all available variables.

## Common Commands

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a service
docker-compose restart backend

# View running containers
docker-compose ps

# Remove all containers and volumes (⚠️ DATA LOSS)
docker-compose down -v
```

### Image Management

```bash
# List images
docker images | grep sanbox

# Remove old images
docker image prune -a

# Build specific service
docker-compose build backend
docker-compose build --no-cache backend  # Force rebuild
```

### Resource Usage

```bash
# View resource usage
docker stats

# Clean up unused resources
docker system prune -a --volumes
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :8000  # or :3000, :5432, etc.

# Kill process
kill -9 <PID>

# Or change port in docker-compose files
```

### Container Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Check container status
docker-compose ps

# Inspect container
docker inspect <container-name>
```

### Database Connection Errors

```bash
# Ensure database is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Test connection
docker-compose exec backend python manage.py dbshell
```

### Permission Errors

**Linux**: Docker containers may have permission issues with mounted volumes.

```bash
# Fix ownership
sudo chown -R $USER:$USER ./backend ./frontend

# Or run docker with current user
USER_ID=$(id -u) GROUP_ID=$(id -g) docker-compose up
```

### Out of Memory

```bash
# Increase Docker memory limit in Docker Desktop Settings
# Or reduce worker count in .env:
GUNICORN_WORKERS=2
CELERY_WORKERS=2
```

### Hot Reload Not Working

**Frontend**:
```bash
# Ensure CHOKIDAR_USEPOLLING is set in docker-compose.dev.yml
# Clear node_modules and rebuild:
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml build --no-cache frontend
docker-compose -f docker-compose.dev.yml up -d
```

**Backend**:
```bash
# Restart backend service
docker-compose -f docker-compose.dev.yml restart backend
```

## Migration from Non-Containerized Setup

### 1. Export Data

```bash
# Export database
python manage.py dumpdata > data.json

# Or use PostgreSQL dump if already using PostgreSQL
pg_dump sanbox_db > sanbox_backup.sql
```

### 2. Copy Media Files

```bash
# Copy uploaded media files to new location
cp -r /path/to/old/media ./backend/media
```

### 3. Start Docker Environment

```bash
./dev-up.sh
```

### 4. Import Data

```bash
# If using dumpdata:
docker-compose -f docker-compose.dev.yml exec backend python manage.py loaddata data.json

# If using PostgreSQL dump:
cat sanbox_backup.sql | docker-compose -f docker-compose.dev.yml exec -T postgres psql -U sanbox_dev -d sanbox_dev
```

### 5. Verify

- Check that all data is present
- Test application functionality
- Verify Celery tasks are working

## Performance Tuning

### Production Optimization

**Gunicorn workers** (in `.env`):
```bash
# Formula: (2 x CPU cores) + 1
GUNICORN_WORKERS=5  # for 2 CPU cores
```

**Celery workers** (in `.env`):
```bash
CELERY_WORKERS=4  # Match your workload
```

**Database connection pooling**: Already configured in settings_docker.py

### Resource Limits

Production compose file includes resource limits. Adjust based on your hardware:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 512M
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [OpenShift Deployment](./openshift/README.md)

## Support

For issues specific to containerization, please open an issue on GitHub with:
- Docker version: `docker --version`
- Compose version: `docker-compose --version`
- OS and version
- Relevant logs: `docker-compose logs`
