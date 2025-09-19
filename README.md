# Sanbox - SAN Infrastructure Management Platform

A comprehensive full-stack application for managing Storage Area Network (SAN) infrastructure, storage systems, and enterprise data management operations.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Database Models & API](#database-models--api)
- [Frontend Components](#frontend-components)
- [Background Tasks](#background-tasks)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

Sanbox is a full-stack Django + React application designed for enterprise storage and SAN management. It provides comprehensive tools for:

- **SAN Management**: Fabric zoning, alias management, WWPN tracking
- **Storage Systems**: Multi-vendor storage system monitoring and management
- **Data Import/Export**: Automated data ingestion from IBM Storage Insights and switch configurations
- **Capacity Planning**: Storage calculators and capacity analysis tools
- **Script Generation**: Automated script generation for storage operations
- **Custom Naming**: Flexible naming conventions with variable substitution

### Technology Stack

#### Backend
- **Django 5.1.6** - Web framework with REST API
- **Django REST Framework** - API development
- **Celery 5.5.3** - Background task processing
- **Redis** - Task queue and caching
- **PostgreSQL** - Production database
- **SQLite** - Development database

#### Frontend
- **React 18** - UI framework with hooks and context
- **React Router 7** - Client-side routing
- **Bootstrap 5.3** - UI components and styling
- **Handsontable 12.4** - Advanced spreadsheet functionality
- **Axios** - HTTP client for API communication
- **Framer Motion** - Animations and transitions

#### Infrastructure
- **PM2** - Process management
- **Nginx** - Reverse proxy and static file serving
- **RHEL 9** - Production operating system

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Django API    │    │   Background    │
│   (Port 3000)   │◄──►│   (Port 8000)   │◄──►│   Tasks         │
│                 │    │                 │    │   (Celery)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         │              │   PostgreSQL    │             │
         └──────────────►│   Database      │◄────────────┘
                        └─────────────────┘
                               │
                        ┌─────────────────┐
                        │     Redis       │
                        │   (Task Queue)  │
                        └─────────────────┘
```

### Production Architecture

```
Internet → Nginx (Port 80) → Django (Port 8000)
                ↓
        React Static Files
        Django Admin Files
        API Proxy (/api/)
        Admin Interface (/admin/)
```

## Project Structure

```
sanbox/
├── backend/                    # Django application
│   ├── sanbox/                # Main Django project
│   │   ├── settings.py        # Development settings
│   │   ├── settings_production.py  # Production settings
│   │   ├── urls.py           # URL routing
│   │   └── celery.py         # Celery configuration
│   ├── core/                 # Core utilities and models
│   │   ├── models.py         # Config, Settings, Naming Rules
│   │   └── views.py          # Core API endpoints
│   ├── customers/            # Customer management
│   ├── san/                  # SAN zoning and fabric management
│   │   ├── models.py         # Fabric, Alias, Zone, WWPN models
│   │   └── views.py          # SAN API endpoints
│   ├── storage/              # Storage system management
│   │   ├── models.py         # Storage, Host, Volume models
│   │   └── views.py          # Storage API endpoints
│   ├── importer/             # Data import functionality
│   │   ├── tasks.py          # Celery background tasks
│   │   └── services.py       # Import logic
│   ├── requirements.txt      # Python dependencies
│   └── manage.py             # Django management
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   │   ├── tables/       # Table components
│   │   │   │   └── GenericTable/  # Advanced table system
│   │   │   ├── navigation/   # Navigation components
│   │   │   ├── forms/        # Form components
│   │   │   ├── calculators/  # Storage calculators
│   │   │   └── tools/        # Utility tools
│   │   ├── pages/            # Page components
│   │   ├── context/          # React context providers
│   │   ├── hooks/            # Custom React hooks
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   └── package.json          # Node dependencies
├── ecosystem.config.js       # PM2 configuration
├── deploy.sh                 # Production deployment script
├── CLAUDE.md                 # Development guidelines
└── README.md                 # This file
```

## Key Features

### 1. Advanced Table System (GenericTable)
- **Server-side pagination** with configurable page sizes
- **Advanced filtering** with column-specific filter types
- **Export capabilities** (Excel, CSV) with custom formatting
- **Inline editing** with validation and error handling
- **Context menus** for row-level operations
- **Bulk operations** for mass data manipulation
- **Column management** with show/hide and reordering
- **Persistent user preferences** for table configurations

### 2. SAN Management
- **Fabric Management**: Multi-vendor support (Brocade, Cisco)
- **Zone Management**: Smart and standard zoning with automated member assignment
- **Alias Management**: WWPN tracking with automatic initiator/target detection
- **WWPN Prefix Detection**: Automatic classification based on vendor OUIs
- **Script Generation**: Automated zone creation and deletion scripts

### 3. Storage Management
- **Multi-vendor Support**: IBM FlashSystem, DS8000, Data Domain
- **Capacity Tracking**: Real-time capacity monitoring and forecasting
- **Host Management**: WWPN alignment and relationship tracking
- **Volume Management**: Detailed volume information and mapping
- **Storage Calculators**: Capacity planning and conversion tools

### 4. Data Import System
- **IBM Storage Insights Integration**: Automated data import via API
- **Switch Configuration Import**: Bulk import of switch configurations
- **Background Processing**: Celery-based async import handling
- **Import Status Tracking**: Real-time progress monitoring
- **Error Handling**: Comprehensive error reporting and recovery

### 5. Custom Naming System
- **Flexible Pattern Definition**: Text and variable combination
- **Variable Substitution**: Custom and column-based variables
- **Per-Customer Rules**: Customer-specific naming conventions
- **Bulk Application**: Apply naming rules to multiple records

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis server
- PostgreSQL (for production-like setup)

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup database
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start development server
npm start
```

### Redis Setup (Required for Celery)

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis

# Install Redis (RHEL/CentOS)
sudo dnf install redis
sudo systemctl start redis
```

### Celery Worker Setup

```bash
# In backend directory with venv activated
cd backend

# Start Celery worker
celery -A sanbox worker --loglevel=info

# Start Celery beat scheduler (separate terminal)
celery -A sanbox beat --loglevel=info
```

### Development URLs
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/
- **Django Admin**: http://localhost:8000/admin/

## Production Deployment

### Quick Deployment
```bash
# On production server
cd /var/www/sanbox
./deploy.sh
```

### Initial Production Setup

1. **System Dependencies**
```bash
sudo dnf update -y
sudo dnf install python3.11 python3.11-pip nodejs npm git nginx postgresql postgresql-server redis -y
sudo npm install -g pm2
```

2. **Database Setup**
```bash
sudo postgresql-setup --initdb
sudo systemctl start postgresql redis
sudo systemctl enable postgresql redis

# Create database and user
sudo -u postgres psql
CREATE DATABASE sanbox_db;
CREATE USER sanbox_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE sanbox_db TO sanbox_user;
\q
```

3. **Application Deployment**
```bash
cd /var/www
sudo git clone https://github.com/rickkoe/sanbox.git
cd sanbox
./deploy.sh
```

### Production Services Management

```bash
# PM2 Commands
pm2 status                    # Check all services
pm2 logs sanbox-django        # View Django logs
pm2 restart sanbox-django     # Restart Django
pm2 restart sanbox-celery-worker  # Restart Celery worker

# System Services
sudo systemctl status nginx
sudo systemctl reload nginx
sudo systemctl status postgresql
sudo systemctl status redis
```

## Database Models & API

### Core Models

#### Core App
- **Project**: Project organization and management
- **Config**: Customer-specific configuration settings
- **TableConfiguration**: User-specific table preferences
- **AppSettings**: Application-wide user settings
- **CustomNamingRule**: Flexible naming pattern definitions
- **CustomVariable**: User-defined variables for naming

#### SAN App
- **Fabric**: SAN fabric definitions (Brocade/Cisco)
- **Alias**: WWPN aliases with automatic type detection
- **Zone**: Zone definitions with member management
- **WwpnPrefix**: WWPN OUI prefix definitions for auto-classification

#### Storage App
- **Storage**: Storage system definitions with comprehensive metrics
- **Host**: Host definitions with WWPN tracking
- **HostWwpn**: Individual WWPN assignments with source tracking
- **Volume**: Volume information with capacity and tier data

#### Customers App
- **Customer**: Customer organization definitions

#### Importer App
- **StorageImport**: Import job tracking and status

### API Structure

All API endpoints are prefixed with `/api/` and organized by app:

```
/api/core/          # Core functionality
├── projects/       # Project management
├── configs/        # Configuration management
├── table-configs/  # Table preferences
└── app-settings/   # Application settings

/api/customers/     # Customer management
├── customers/      # Customer CRUD operations

/api/san/           # SAN operations
├── fabrics/        # Fabric management
├── aliases/        # Alias management
├── zones/          # Zone management
└── wwpn-prefixes/  # WWPN prefix management

/api/storage/       # Storage management
├── storage/        # Storage system management
├── hosts/          # Host management
├── host-wwpns/     # WWPN assignments
└── volumes/        # Volume management

/api/importer/      # Data import operations
├── storage-imports/ # Import job management
└── import-status/   # Real-time status tracking
```

## Frontend Components

### GenericTable System
The heart of the frontend is the advanced `GenericTable` component located in `frontend/src/components/tables/GenericTable/`.

**Key Features:**
- **Server-side pagination** with configurable page sizes (25, 50, 100, 250, All)
- **Advanced filtering** with column-specific filter types
- **Export functionality** with Excel and CSV support
- **Inline editing** with real-time validation
- **Context menus** for row operations
- **Bulk operations** for mass updates
- **Column management** with show/hide and reordering
- **Persistent preferences** saved per user/customer/table

**Usage Example:**
```jsx
<GenericTable
  apiEndpoint="/api/storage/storage/"
  columns={storageColumns}
  tableName="storage"
  enableBulkOperations={true}
  enableExport={true}
  enableInlineEdit={true}
/>
```

### Navigation System
- **Navbar**: Top navigation with dropdowns and user controls
- **Sidebar**: Collapsible side navigation with context-aware content
- **Breadcrumbs**: Dynamic breadcrumb navigation
- **Context-Aware Styling**: Different layouts for table vs. content pages

### Context Providers
- **ConfigContext**: Customer configuration management
- **SanVendorContext**: SAN vendor-specific settings
- **ImportStatusContext**: Real-time import status tracking
- **SettingsContext**: User preferences and application settings
- **TableControlsContext**: Shared table control state

## Background Tasks

### Celery Configuration
Background tasks are handled by Celery with Redis as the message broker.

**Task Types:**
- **Data Import Tasks**: IBM Storage Insights API integration
- **Bulk Operations**: Mass data processing
- **Report Generation**: Export and reporting tasks
- **Maintenance Tasks**: Database cleanup and optimization

**Key Tasks:**
```python
# Storage Insights Import
import_storage_insights.delay(customer_id, api_credentials)

# Bulk Zone Creation
create_zones_bulk.delay(zone_data, fabric_id)

# Data Export
export_table_data.delay(table_name, filters, format)
```

### Monitoring Tasks
```bash
# Check Celery worker status
pm2 status sanbox-celery-worker

# View task logs
pm2 logs sanbox-celery-worker

# Monitor Redis queue
redis-cli monitor
```

## Common Operations

### Development Workflow

1. **Start Development Environment**
```bash
# Terminal 1: Backend
cd backend && source venv/bin/activate
python manage.py runserver

# Terminal 2: Frontend
cd frontend
npm start

# Terminal 3: Celery Worker
cd backend && source venv/bin/activate
celery -A sanbox worker --loglevel=info

# Terminal 4: Celery Beat (if needed)
cd backend && source venv/bin/activate
celery -A sanbox beat --loglevel=info
```

2. **Database Operations**
```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Reset database (development)
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

3. **Frontend Development**
```bash
# Install new package
npm install --save package-name

# Build for production
npm run build

# Run tests
npm test
```

### Production Operations

1. **Deployment**
```bash
# Full deployment
./deploy.sh

# Deployment with specific version
./deploy.sh v1.2.3
```

2. **Service Management**
```bash
# Restart all services
pm2 restart all

# View logs
pm2 logs --lines 50

# Monitor services
pm2 monit
```

3. **Database Backup**
```bash
# Backup database
sudo -u postgres pg_dump sanbox_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
sudo -u postgres psql sanbox_db < backup_file.sql
```

### API Usage Examples

1. **Get Storage Systems**
```bash
curl -X GET http://localhost:8000/api/storage/storage/
```

2. **Create New Alias**
```bash
curl -X POST http://localhost:8000/api/san/aliases/ \
  -H "Content-Type: application/json" \
  -d '{"name": "alias1", "wwpn": "50:01:23:45:67:89:ab:cd", "fabric": 1}'
```

3. **Filter Tables**
```bash
curl -X GET "http://localhost:8000/api/storage/storage/?storage_type=FlashSystem&page_size=50"
```

## Troubleshooting

### Common Issues

#### 1. Django Admin Styling Issues
**Problem**: Admin interface appears unstyled
**Cause**: Accessing Django directly on port 8000 instead of through Nginx
**Solution**: Use domain URL instead of :8000 in production

#### 2. Celery Worker Not Starting
**Problem**: Celery worker fails to start
**Solutions**:
- Check Redis connection: `redis-cli ping`
- Verify Python path in ecosystem.config.js
- Check for port conflicts

#### 3. Table Data Not Loading
**Problem**: GenericTable shows "No data available"
**Solutions**:
- Check browser console for API errors
- Verify API endpoint is accessible
- Check customer/project configuration
- Verify table permissions

#### 4. Import Tasks Failing
**Problem**: Storage Insights import fails
**Solutions**:
- Check API credentials
- Verify Celery worker is running
- Check Redis connection
- Review import logs: `pm2 logs sanbox-celery-worker`

#### 5. Frontend Build Failures
**Problem**: `npm run build` fails
**Solutions**:
- Clear node_modules: `rm -rf node_modules && npm install --legacy-peer-deps`
- Check for JavaScript errors
- Verify all dependencies are compatible

### Health Checks

```bash
# Complete system health check
echo "=== System Health Check ==="
echo "PostgreSQL:" $(sudo systemctl is-active postgresql)
echo "Redis:" $(sudo systemctl is-active redis)
echo "Nginx:" $(sudo systemctl is-active nginx)
pm2 status

# Test endpoints
curl -s -o /dev/null -w "%{http_code}" http://localhost/
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/
curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/
```

### Log Locations

**Development:**
- Django: Terminal output
- React: Browser console
- Celery: Terminal output

**Production:**
- Django: `pm2 logs sanbox-django`
- Celery Worker: `pm2 logs sanbox-celery-worker`
- Celery Beat: `pm2 logs sanbox-celery-beat`
- Nginx: `/var/log/nginx/error.log`
- PostgreSQL: `/var/lib/pgsql/data/log/`
- Redis: `sudo journalctl -u redis -f`

## Contributing

### Development Guidelines

1. **Code Style**
   - Follow existing code conventions
   - Use meaningful variable and function names
   - Add comments for complex logic
   - Write tests for new features

2. **Git Workflow**
   - Create feature branches from main
   - Use descriptive commit messages
   - Test thoroughly before pushing
   - Use pull requests for code review

3. **Database Changes**
   - Always create migrations for model changes
   - Test migrations on development data
   - Document any manual migration steps

4. **Frontend Development**
   - Use existing components when possible
   - Follow React best practices
   - Test across different screen sizes
   - Ensure accessibility compliance

### Testing

```bash
# Backend tests
python manage.py test

# Frontend tests
npm test

# Integration tests
npm run test:integration
```

### Performance Considerations

1. **Database**
   - Use indexes for frequently queried fields
   - Optimize complex queries
   - Use select_related and prefetch_related

2. **Frontend**
   - Lazy load heavy components
   - Use pagination for large datasets
   - Optimize bundle size

3. **API**
   - Implement caching where appropriate
   - Use DRF pagination
   - Monitor query counts

---

## License

This project is proprietary software. All rights reserved.

## Contact

- **Repository**: https://github.com/rickkoe/sanbox
- **Production URL**: http://sanbox.esilabs.com

---

*Last Updated: January 2025 | Version: 1.0.0*