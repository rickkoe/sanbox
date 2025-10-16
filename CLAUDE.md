# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanbox is a full-stack application for managing SAN (Storage Area Network) infrastructure, storage systems, and enterprise data management. The application provides tools for SAN zoning, storage calculations, data import/export, and system monitoring.

**Architecture**: React frontend (port 3000) + Django REST API backend (port 8000)
**Deployment**: Docker containers for development and production

## Development Commands (Container-Based)

### Quick Start

```bash
# Start all services (PostgreSQL, Redis, Django, Celery, React)
./start           # or ./dev-up.sh

# Stop all services
./stop            # or ./dev-down.sh

# View container status
./status

# View logs
./logs            # All services
./logs backend    # Just backend
./logs frontend   # Just frontend
```

**What happens when you start**:
- PostgreSQL database starts
- Redis cache/broker starts
- Django backend starts with hot-reload
- Celery worker and beat start
- React frontend starts with hot-reload

**Edit code normally** - changes auto-reload!
- Backend: Edit files in `./backend/` - Django auto-reloads
- Frontend: Edit files in `./frontend/src/` - React auto-reloads

### Django Commands (via Docker)

```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

# Create superuser
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Django shell
./shell           # or docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

# Run tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Any Django command
docker-compose -f docker-compose.dev.yml exec backend python manage.py <command>
```

### Frontend Commands (via Docker)

```bash
# Install new package
docker-compose -f docker-compose.dev.yml exec frontend npm install <package-name> --legacy-peer-deps

# Run frontend tests
docker-compose -f docker-compose.dev.yml exec frontend npm test

# Build production
docker-compose -f docker-compose.dev.yml exec frontend npm run build
```

### Database Access

```bash
# PostgreSQL shell
docker-compose -f docker-compose.dev.yml exec postgres psql -U sanbox_dev -d sanbox_dev

# Backup database
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U sanbox_dev sanbox_dev > backup.sql

# Restore database
cat backup.sql | docker-compose -f docker-compose.dev.yml exec -T postgres psql -U sanbox_dev -d sanbox_dev
```

### Production Deployment

```bash
# Deploy specific version (pulls from GitHub)
./deploy-container.sh v1.2.3

# Deploy latest from main branch
./deploy-container.sh

# Rollback to previous version
./rollback.sh v1.2.2
```

### HTTPS/SSL Setup (Production)

To enable HTTPS for secure clipboard operations and general security:

```bash
# 1. Ensure your domain points to the server's IP address
# 2. Make sure ports 80 and 443 are open in your firewall

# 3. Run the SSL setup script (requires root/sudo)
sudo ./setup-ssl.sh your-domain.com your-email@example.com

# Example:
sudo ./setup-ssl.sh sanbox.esilabs.com admin@esilabs.com
```

**What the SSL setup does**:
1. Installs Certbot (if not already installed)
2. Generates Let's Encrypt SSL certificates for your domain
3. Configures nginx to use HTTPS with automatic HTTP→HTTPS redirect
4. Sets up automatic certificate renewal (runs twice daily)
5. Updates environment variables for HTTPS

**Post-SSL Setup**:
- Your app will be accessible at `https://your-domain.com`
- Clipboard API will work properly (requires secure context)
- Certificates auto-renew before expiration
- Check renewal log: `/var/log/sanbox-ssl-renewal.log`
- Test renewal: `certbot renew --dry-run`

**Manual Certificate Renewal** (if needed):
```bash
sudo /usr/local/bin/renew-sanbox-ssl.sh
```

**Troubleshooting HTTPS**:
- Verify domain DNS: `nslookup your-domain.com`
- Check certificate: `certbot certificates`
- View nginx logs: `./logs frontend`
- Ensure `.env` has HTTPS URLs in CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS

## Application Architecture

### Backend Structure
- **Django Project**: `sanbox/` - Main Django project configuration
  - `settings.py` - Local development (non-container, legacy)
  - `settings_docker.py` - Container-based configuration (primary)
  - `settings_production.py` - Legacy production settings
- **Django Apps**:
  - `core/` - Core application utilities and base models
  - `customers/` - Customer management
  - `san/` - SAN zoning, aliases, fabrics, and WWN management
  - `storage/` - Storage system management and volume tracking
  - `importer/` - Data import functionality with Celery tasks

### Frontend Structure
- **Components**:
  - `components/tables/GenericTable/` - Reusable table component with Handsontable integration
  - `components/navigation/` - Navbar, Sidebar, Breadcrumbs
  - `components/forms/` - Configuration and data import forms
  - `components/calculators/` - Storage capacity calculators
  - `components/tools/` - Utility tools (WWPN formatting, etc.)
- **Pages**: Route-specific page components
- **Context**: React context providers for global state
- **Hooks**: Custom React hooks for data fetching and table operations

### Key Technologies
- **Frontend**: React 18, React Router, Bootstrap, Handsontable, Axios
- **Backend**: Django 5.1.6, Django REST Framework, Celery, Redis
- **Database**: PostgreSQL 16 (in containers)
- **Deployment**: Docker, Docker Compose, Gunicorn, Nginx

## Database Models

The application uses five main Django apps with their respective models:
- **customers**: Customer and organization data
- **san**: SAN fabric, zone, alias, and device management
- **storage**: Storage system, volume, and capacity tracking
- **importer**: Data import jobs and status tracking
- **core**: Base models and utilities

## Important Development Notes

### GenericTable Component
The `GenericTable` component (frontend/src/components/tables/GenericTable/) is the core reusable table component used throughout the application. It uses Handsontable for advanced spreadsheet-like functionality including:
- Server-side pagination
- Column sorting and filtering
- Export capabilities (Excel, CSV)
- Inline editing with validation
- Context menus and bulk operations

### API Structure
All API endpoints are prefixed with `/api/` and organized by app:
- `/api/core/` - Core utilities
- `/api/customers/` - Customer management
- `/api/san/` - SAN operations
- `/api/storage/` - Storage management
- `/api/insights/` - Data import operations

### Testing
- Frontend: `docker-compose -f docker-compose.dev.yml exec frontend npm test`
- Backend: `docker-compose -f docker-compose.dev.yml exec backend python manage.py test`
- Always test table operations with the GenericTable component

### Container Development
- **Hot-reload enabled**: Changes to code auto-reload in containers
- **Source mounts**: Local code directories are mounted into containers
- **Persistent data**: Database data persists in Docker volumes
- **Port mappings**:
  - Frontend: http://localhost:3000
  - Backend: http://localhost:8000
  - PostgreSQL: localhost:5432 (accessible for direct connections)
  - Redis: localhost:6379

## Key Files and Configurations

- `frontend/src/components/tables/GenericTable/GenericTable.jsx` - Main table component
- `backend/sanbox/settings_docker.py` - Container Django settings (primary)
- `backend/sanbox/urls.py` - Main URL routing
- `docker-compose.dev.yml` - Development orchestration
- `docker-compose.yml` - Production orchestration
- `deploy-container.sh` - Container deployment script
- `.env.dev` - Development environment variables

## Context and State Management

The application uses React Context for global state:
- `BreadcrumbContext` - Navigation breadcrumbs
- `ConfigContext` - Application configuration
- `SanVendorContext` - SAN vendor-specific data

## Common Tasks

1. **Adding a new table**: Create a new page component that uses GenericTable with appropriate API endpoints

2. **Adding new API endpoints**: Create views in the relevant Django app and update urls.py

3. **Database changes**:
   ```bash
   # Create migrations
   docker-compose -f docker-compose.dev.yml exec backend python manage.py makemigrations

   # Apply migrations
   docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
   ```

4. **Adding new calculators**: Create components in `components/calculators/` and add routes in App.js

5. **Debugging backend**:
   - View logs: `./logs backend`
   - Django shell: `./shell`
   - Interactive debugging: Set breakpoint in code and attach with `docker attach sanbox_dev_backend`

6. **Debugging frontend**:
   - View logs: `./logs frontend`
   - Browser DevTools work normally
   - React DevTools extension works

## Accessing Services

When containers are running:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/
- **PostgreSQL**: `localhost:5432` (user: sanbox_dev, db: sanbox_dev)
- **Redis**: `localhost:6379`

## Legacy Files (Archived)

The following files are archived with `.backup` extension and should not be used:
- `OLD_dev_start.sh.backup` - Legacy non-container startup
- `OLD_dev_stop.sh.backup` - Legacy non-container shutdown
- `OLD_deploy.sh.backup` - Legacy non-container deployment
- `OLD_ecosystem.config.js.backup` - Legacy PM2 configuration

Use container-based scripts instead: `./start`, `./stop`, `./deploy-container.sh`
