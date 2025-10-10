# Container Quick Start Guide

## 📋 Prerequisites

### Install Docker

**Required**: Docker Desktop (Mac/Windows) or Docker Engine (Linux)

**Quick Install**:

- **Mac**: Download from https://www.docker.com/products/docker-desktop or `brew install --cask docker`
- **Windows**: Download from https://www.docker.com/products/docker-desktop (requires WSL 2)
- **Linux**: `curl -fsSL https://get.docker.com | sudo sh`

**Verify**: `docker --version && docker-compose --version`

See [DOCKER_INSTALLATION.md](DOCKER_INSTALLATION.md) for detailed installation instructions.

## 🚀 Development on Mac (Current Setup)

### First Time Setup

```bash
# 1. Start development environment
./dev-up.sh

# 2. Create superuser when prompted
# (or later: docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser)

# 3. Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Admin: http://localhost:8000/admin/
```

### Daily Development

```bash
# Start containers
./dev-up.sh

# Edit code in ./backend/ or ./frontend/src/
# Changes auto-reload automatically!

# Stop containers (keeps data)
./dev-down.sh
```

### Useful Commands

```bash
# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend

# Run Django commands
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

# Database access
docker-compose -f docker-compose.dev.yml exec postgres psql -U sanbox_dev -d sanbox_dev

# Install npm package
docker-compose -f docker-compose.dev.yml exec frontend npm install <package-name>
```

## 🐳 Production Deployment (Docker)

### Option 1: Git-Based Deployment (Recommended)

**Maintains your existing workflow** - deploy by git tag just like `./deploy.sh v1.2.3`

```bash
# On production server

# 1. First time: Edit deploy-container.sh with your GitHub repo URL
nano deploy-container.sh  # Set REPO_URL

# 2. Deploy specific version
./deploy-container.sh v1.2.3

# OR deploy latest from main
./deploy-container.sh

# 3. Rollback if needed
./rollback.sh v1.2.2
```

### Option 2: Registry-Based Deployment

**For CI/CD** - build once, deploy to multiple servers

```bash
# On dev machine: Build and push
./build-and-push.sh v1.2.3 ghcr.io/your-org/sanbox

# On production server: Deploy from registry
./deploy-container-remote.sh v1.2.3 ghcr.io/your-org/sanbox
```

### Option 3: Local Build

**Simple approach** - build and deploy locally

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with production values

# 2. Build production images
./build.sh production

# 3. Start services
docker-compose up -d

# 4. Run initial setup
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
```

### Management

```bash
# View status
docker-compose ps

# View logs
docker-compose logs -f

# Restart service
docker-compose restart backend

# Stop all
docker-compose down

# Check deployed version
cat /var/www/sanbox/deployment-info.txt
```

## ☸️ OpenShift Deployment

See [openshift/README.md](openshift/README.md) for detailed instructions.

### Quick Deploy

```bash
# 1. Create project
oc new-project sanbox-production

# 2. Create secrets
oc create secret generic sanbox-secrets \
  --from-literal=DJANGO_SECRET_KEY='your-secret-key' \
  --from-literal=POSTGRES_USER='sanbox_user' \
  --from-literal=POSTGRES_PASSWORD='your-password'

# 3. Deploy
cd openshift
oc apply -f configmaps.yaml
oc apply -f pvc.yaml
oc apply -f services.yaml
oc apply -f deployment.yaml
oc apply -f routes.yaml

# 4. Check status
oc get pods
oc get route sanbox
```

## 📂 Project Structure

```
sanbox/
├── backend/
│   ├── Dockerfile                    # Django backend container
│   ├── .dockerignore
│   └── sanbox/settings_docker.py     # Container-specific settings
├── frontend/
│   ├── Dockerfile                    # React frontend container
│   ├── nginx.conf                    # Nginx config for production
│   └── .dockerignore
├── nginx/
│   ├── Dockerfile                    # Reverse proxy container
│   └── nginx.conf
├── openshift/                        # Kubernetes/OpenShift manifests
│   ├── deployment.yaml
│   ├── services.yaml
│   ├── routes.yaml
│   ├── configmaps.yaml
│   ├── secrets.yaml.example
│   ├── pvc.yaml
│   └── README.md
├── docker-compose.dev.yml            # Development with hot-reload
├── docker-compose.yml                # Production deployment
├── .env.example                      # Environment variables template
├── .env.dev                          # Development defaults
├── build.sh                          # Build images
├── dev-up.sh                         # Start development
├── dev-down.sh                       # Stop development
├── DOCKER.md                         # Detailed Docker guide
└── CONTAINER_QUICKSTART.md           # This file
```

## 🔧 Troubleshooting

### Port conflicts

```bash
# Check what's using a port
lsof -i :8000

# Change port in docker-compose files if needed
```

### Container won't start

```bash
# Check logs
docker-compose logs <service-name>

# Rebuild
docker-compose build --no-cache <service-name>
```

### Database issues

```bash
# Reset database (⚠️ destroys data)
docker-compose down -v
docker-compose up -d
```

### Hot-reload not working

```bash
# Restart the service
docker-compose -f docker-compose.dev.yml restart backend
# or
docker-compose -f docker-compose.dev.yml restart frontend
```

## 📚 Documentation

- **Docker Details**: [DOCKER.md](DOCKER.md)
- **OpenShift Deployment**: [openshift/README.md](openshift/README.md)
- **Main README**: [README.md](README.md)
- **Project Instructions**: [CLAUDE.md](CLAUDE.md)

## 🎯 Key Features

✅ **Cross-platform**: Runs on Mac, Windows, Linux
✅ **Hot-reload**: Code changes reflect immediately in development
✅ **Production-ready**: Optimized images for deployment
✅ **OpenShift compatible**: Non-root, secure containers
✅ **Isolated environment**: No local Python/Node.js setup needed
✅ **Consistent**: Same environment across all developers

## 💡 Tips

- Development containers mount source code - changes appear immediately
- Production containers bake code into images - rebuild to update
- Use `./dev-up.sh` for daily development
- Use `docker-compose exec` to run commands inside containers
- Logs directory is at `./dev_logs/` in development
- Database data persists in Docker volumes even after stopping containers
