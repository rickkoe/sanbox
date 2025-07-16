# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sanbox is a full-stack application for managing SAN (Storage Area Network) infrastructure, storage systems, and enterprise data management. The application provides tools for SAN zoning, storage calculations, data import/export, and system monitoring.

**Architecture**: React frontend (port 3000) + Django REST API backend (port 8000)

## Development Commands

### Frontend (React)
```bash
cd frontend
npm install --legacy-peer-deps  # Install dependencies
npm start                       # Start development server
npm run build                   # Build for production
npm test                        # Run tests
```

### Backend (Django)
```bash
cd backend
python -m venv venv            # Create virtual environment
source venv/bin/activate       # Activate virtual environment (Linux/Mac)
pip install -r requirements.txt # Install dependencies
python manage.py migrate       # Run database migrations
python manage.py runserver     # Start development server
python manage.py collectstatic # Collect static files for production
python manage.py createsuperuser # Create admin user
```

### Production Deployment
```bash
./deploy.sh                    # Full deployment script (see README.md)
```

## Application Architecture

### Backend Structure
- **Django Project**: `sanbox/` - Main Django project configuration
- **Django Apps**:
  - `core/` - Core application utilities and base models
  - `customers/` - Customer management
  - `san/` - SAN zoning, aliases, fabrics, and WWN management
  - `storage/` - Storage system management and volume tracking
  - `insights_importer/` - Data import functionality with Celery tasks

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
- **Database**: SQLite (development), PostgreSQL (production)
- **Deployment**: PM2, Nginx, RHEL 9

## Database Models

The application uses five main Django apps with their respective models:
- **customers**: Customer and organization data
- **san**: SAN fabric, zone, alias, and device management
- **storage**: Storage system, volume, and capacity tracking
- **insights_importer**: Data import jobs and status tracking
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
- Use `npm test` for frontend React tests
- Use `python manage.py test` for backend Django tests
- Always test table operations with the GenericTable component

### Production Considerations
- Frontend proxy configuration points to Django backend at `http://127.0.0.1:8000`
- Production uses settings_production.py for Django configuration
- Static files are served through Nginx in production
- Celery handles background tasks for data imports

## Key Files and Configurations

- `frontend/src/components/tables/GenericTable/GenericTable.jsx` - Main table component
- `backend/sanbox/settings.py` - Django development settings
- `backend/sanbox/settings_production.py` - Production Django settings
- `backend/sanbox/urls.py` - Main URL routing
- `ecosystem.config.js` - PM2 process management configuration
- `deploy.sh` - Production deployment script

## Context and State Management

The application uses React Context for global state:
- `BreadcrumbContext` - Navigation breadcrumbs
- `ConfigContext` - Application configuration
- `SanVendorContext` - SAN vendor-specific data

## Common Tasks

1. **Adding a new table**: Create a new page component that uses GenericTable with appropriate API endpoints
2. **Adding new API endpoints**: Create views in the relevant Django app and update urls.py
3. **Database changes**: Create migrations with `python manage.py makemigrations` then `python manage.py migrate`
4. **Adding new calculators**: Create components in `components/calculators/` and add routes in App.js