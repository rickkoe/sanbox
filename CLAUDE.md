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
```

### Backup and Restore

**Important**: Use the built-in Backup Management UI (`/backups`) instead of manual database dumps. The application provides:
- Automatic scheduled backups (hourly or daily)
- Pre-restore safety backups
- Backup verification and metadata tracking
- One-click restore with automatic pre-restore backup

**Access Backup Management**:
- Navigate to `/backups` in the application
- Configure automatic backups via "Configure Schedule"
- Create manual backups via "Create Backup"
- Restore from any backup via the "Restore" button

**How Backups Work**:
- Backups are stored in `/app/backups/` within the container
- Backup metadata tables are excluded from backups to prevent corruption during restore
- Pre-restore safety backups are automatically created before each restore
- Backups include all application data (zones, aliases, customers, storage, etc.)
- Restore history is tracked in the Restore History page

**Manual Database Operations** (if needed):
```bash
# Manual backup (not recommended - use UI instead)
docker-compose -f docker-compose.dev.yml exec postgres pg_dump -U sanbox_dev sanbox_dev > backup.sql

# Manual restore (not recommended - use UI instead)
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

Two options available depending on your deployment:

#### Option 1: Let's Encrypt SSL (For Public/Internet-Accessible Servers)

For servers with a public IP accessible from the internet:

```bash
# 1. Ensure your domain points to the server's PUBLIC IP address
# 2. Make sure ports 80 and 443 are open in your firewall

# 3. Run the SSL setup script (requires root/sudo)
sudo ./setup-ssl.sh your-domain.com your-email@example.com

# Example:
sudo ./setup-ssl.sh sanbox.example.com admin@example.com
```

**What the SSL setup does**:
1. Installs Certbot (if not already installed) - supports RHEL 8/9, CentOS, Debian, Ubuntu
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

#### Option 2: Self-Signed Certificate (For Internal/VPN-Only Servers)

For internal servers accessed only via VPN or private networks:

```bash
# Run the self-signed SSL setup script (requires root/sudo)
sudo ./setup-ssl-selfsigned.sh your-internal-domain.com

# Example:
sudo ./setup-ssl-selfsigned.sh ibmdev03.esilabs.com
```

**What the self-signed setup does**:
1. Generates a self-signed SSL certificate (valid for 365 days)
2. Configures nginx to use HTTPS with automatic HTTP→HTTPS redirect
3. Updates environment variables for HTTPS
4. No auto-renewal (manual renewal required before expiration)

**Post-SSL Setup**:
- Your app will be accessible at `https://your-domain.com`
- Clipboard API will work properly (requires secure context)
- **Browsers will show security warnings** (normal for self-signed certs)
  - Chrome/Edge: Click 'Advanced' → 'Proceed to site (unsafe)'
  - Firefox: Click 'Advanced' → 'Accept the Risk and Continue'
  - Safari: Click 'Show Details' → 'visit this website'

**Certificate Renewal** (before 365 days):
```bash
# Re-run the setup script to generate a new certificate
sudo ./setup-ssl-selfsigned.sh your-domain.com
```

**Troubleshooting HTTPS**:
- Verify domain DNS: `nslookup your-domain.com`
- Check certificate: `openssl x509 -in /etc/ssl/sanbox/fullchain.pem -text -noout`
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
  - `backup/` - Database backup and restore functionality with Celery tasks

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

The application uses six main Django apps with their respective models:
- **customers**: Customer and organization data
- **san**: SAN fabric, zone, alias, and device management
- **storage**: Storage system, volume, and capacity tracking
- **importer**: Data import jobs and status tracking
- **backup**: Backup records, restore records, and backup configuration
- **core**: Base models and utilities

**Note**: Backup metadata tables (`backup_backuprecord`, `backup_backuplog`, `backup_restorerecord`, `backup_backupconfiguration`) are automatically excluded from database backups to prevent corruption during restore operations.

## Important Development Notes

### Centralized Table Column Configuration

The application uses a centralized JSON configuration system for managing table columns across all TanStack tables. This provides a single source of truth for column definitions, making it easy to modify column order, visibility, requirements, and default sorting.

**Configuration Files**:
- **`frontend/src/config/tableColumnConfig.json`** - Central JSON file containing all table column definitions
- **`frontend/src/utils/tableConfigLoader.js`** - Utility functions for loading and processing configurations

**Configured Tables**:
All 10 main tables use this system:
- Fabric, Alias, Zone (SAN entities)
- Storage, Volume, Host, Port (Storage entities)
- Switch (Network infrastructure)
- Customer, Project (Management entities)

**Column Properties** (in JSON):
```json
{
  "id": "column_name",           // Column identifier/accessor
  "title": "Column Title",       // Display header text
  "type": "text|dropdown|checkbox|numeric|custom",  // Cell type
  "required": true|false,        // Always visible, can't be hidden
  "defaultVisible": true|false,  // Initial visibility state
  "width": 150,                  // Column width in pixels (optional)
  "readOnly": true|false,        // Whether cell is editable (optional)
  "dropdownSource": "sourceName" // Dropdown data source key (optional)
}
```

**Table-Level Properties**:
```json
{
  "defaultSort": {
    "column": "name",      // Column ID to sort by default
    "direction": "asc"     // Sort direction: "asc" or "desc"
  },
  "columns": [...]         // Array of column definitions
}
```

**Usage in Table Components**:
```javascript
import { getTableColumns, getDefaultSort, getColumnHeaders } from '../../utils/tableConfigLoader';

// Load columns (automatically adds _selected and project_action for Project View)
const columns = useMemo(() => {
    return getTableColumns('fabric', projectFilter === 'current');
}, [projectFilter]);

const colHeaders = useMemo(() => {
    return getColumnHeaders('fabric', projectFilter === 'current');
}, [projectFilter]);

const defaultSort = getDefaultSort('fabric');

// Pass to TanStackCRUDTable
<TanStackCRUDTable
    columns={columns}
    colHeaders={colHeaders}
    defaultSort={defaultSort}
    // ... other props
/>
```

**Key Features**:
- **Single Source of Truth**: All column configurations in one JSON file
- **Easy Maintenance**: Change column order, visibility, or requirements without touching table code
- **Automatic Project View Columns**: `_selected` checkbox and `project_action` status columns are automatically added in Project View
- **Consistent Behavior**: All tables follow the same patterns
- **Default Sorting**: Configurable default sort column and direction per table

**Modifying Column Configuration**:
1. **Change Column Order**: Reorder columns in the `columns` array in JSON
2. **Change Visibility**: Set `defaultVisible: true` or `false`
3. **Make Column Required**: Set `required: true` (always visible, can't be hidden)
4. **Change Default Sort**: Update `defaultSort.column` and `defaultSort.direction`
5. **Add New Column**: Add new object to `columns` array with required properties

**Helper Functions** (from `tableConfigLoader.js`):
- `getTableColumns(tableName, includeProjectColumns)` - Returns column array
- `getColumnHeaders(tableName, includeProjectColumns)` - Returns header array
- `getDefaultSort(tableName)` - Returns `{ column, direction }` object
- `getRequiredColumns(tableName)` - Returns array of required column IDs
- `getDefaultVisibleColumns(tableName, includeProjectColumns)` - Returns array of visible column IDs
- `validateConfig()` - Validates JSON structure (for development)
- `getAvailableTables()` - Returns array of all configured table names

**Customer View vs Project View**:
- All data columns configured in JSON appear in both views
- Project View automatically adds two additional columns:
  - `_selected`: Checkbox column for bulk operations (first column) - **Required, can't be hidden**
  - `project_action`: Status indicator showing New/Modified/Delete/Unmodified (after name column) - **Required, can't be hidden**
- These special columns are managed by the config loader and don't need to be in the JSON

**Changing System Column Positions**:
To change where `_selected` or `project_action` appear, edit `frontend/src/utils/tableConfigLoader.js`:

- **`_selected` position**: Currently added first (line 59-70). To move it:
  - Cut the entire block and paste it after the `config.columns.forEach()` loop to make it last
  - Or insert it at a specific index using `columns.splice()`

- **`project_action` position**: Currently inserted after the "name" column (line 96-106). To change:
  - Change `"name"` to another column ID to insert after that column instead
  - Set `insertIndex = columns.length` to place it at the end
  - Set `insertIndex = <number>` to place it at a specific position (0 = first)

**Example Configuration** (Fabric Table):
```json
{
  "fabric": {
    "defaultSort": {
      "column": "name",
      "direction": "asc"
    },
    "columns": [
      {
        "id": "name",
        "title": "Name",
        "type": "text",
        "required": true,
        "defaultVisible": true
      },
      {
        "id": "san_vendor",
        "title": "Vendor",
        "type": "dropdown",
        "dropdownSource": "san_vendor",
        "required": true,
        "defaultVisible": true
      },
      {
        "id": "vsan",
        "title": "VSAN",
        "type": "numeric",
        "defaultVisible": false
      }
    ]
  }
}
```

**Special Cases**:
- **Alias Table**: Has dynamic WWPN columns added programmatically (preserved alongside config columns)
- **Zone Table**: Has complex structure with dynamic member columns (uses filtered config for base/trailing columns)
- **Port Table**: Uses `hideColumns` prop to filter configured columns based on context

### Universal Importer
The **Universal Importer** (`/import/universal`) is the unified data import system that handles both SAN and Storage imports:

**Supported Import Types**:
1. **SAN Configuration Import**
   - Cisco and Brocade switch configurations
   - Auto-detects vendor from CLI output
   - Imports: Fabrics, Zones, Aliases, WWPNs
   - Supports multi-fabric imports with fabric mapping
   - Conflict resolution for duplicate aliases/zones

2. **IBM Storage Insights Import**
   - Connects to IBM Storage Insights API
   - Imports: Storage Systems, Volumes, Hosts, WWPNs
   - Preview before import
   - Selective system import

**Architecture**:
- **Frontend**: `pages/UniversalImporter.jsx` - Multi-step wizard interface
- **Backend**: `importer/import_orchestrator.py` - Unified orchestration layer
- **Parsers**: Auto-detect format and parse data
  - `parsers/cisco_parser.py` - Cisco switch configs
  - `parsers/brocade_parser.py` - Brocade switch configs
  - `parsers/insights_parser.py` - IBM Storage Insights JSON
- **Tasks**: `importer/tasks.py` - Celery async import tasks with progress tracking

**Key Features**:
- Real-time progress tracking with ImportProgress component
- Comprehensive error logging with ImportLogger
- Preview data before importing
- Statistics display on completion
- Celery-based async processing for large imports

**Important Notes**:
- Hosts are linked to Storage systems (not Projects)
- Host uniqueness: `(name, storage)` tuple
- WWPNs stored in separate `HostWwpn` table with source tracking
- Imports are customer-scoped with permission checks

**Legacy Importers Removed**:
- Old standalone Storage Insights Importer (removed Oct 2025)
- All imports now go through Universal Importer

### GenericTable Component
The `GenericTable` component (frontend/src/components/tables/GenericTable/) is the core reusable table component used throughout the application. It uses Handsontable for advanced spreadsheet-like functionality including:
- Server-side pagination
- Column sorting and filtering
- Export capabilities (Excel, CSV)
- Inline editing with validation
- Context menus and bulk operations

### TanStackCRUDTable Patterns

The `TanStackCRUDTable` component (`frontend/src/components/tables/TanStackTable/TanStackCRUDTable.jsx`) is the modern table implementation used throughout the application. It provides advanced features including dirty state tracking, in-place editing, and custom renderers.

#### Updating Table Data Without Triggering Dirty State

**Problem**: When updating display-only fields (badges, statuses, project memberships) after an API operation, calling `setTableData()` triggers the dirty state indicator, making it appear there are unsaved changes even though the operation already succeeded.

**Solution**: Use `updateTableDataSilently()` for clean updates, or conditionally choose between silent and dirty updates based on whether the user has unsaved edits.

**Available Methods**:
1. `setTableData(data)` - Updates table data AND marks it as dirty (shows "Unsaved" indicator)
2. `updateTableDataSilently(data)` - Updates table data WITHOUT marking as dirty (silent update)
3. `reloadData()` - Fetches fresh data from server (causes table flash)

**When to Use Each**:

Use **`updateTableDataSilently()`** when:
- Updating display-only fields after a successful API operation (badges, status indicators, etc.)
- The data change was already persisted to the server
- You want to avoid false "Unsaved changes" warnings

Use **`setTableData()`** when:
- Preserving user's unsaved edits during an update
- The table already has dirty changes that should be maintained

Use **`reloadData()`** when:
- You need to fetch completely fresh data from the server
- You're okay with a table flash/reload
- You want to discard any local changes

**Example: Adding Entity to Project**

```javascript
// After successful API call to add alias/zone to project
const hadDirtyChanges = window.aliasTableRef?.current?.hasChanges;
const currentData = window.aliasTableRef?.current?.getTableData();

const success = await handleAddAliasToProject(aliasId, action);

if (success && currentData) {
    // Update just the affected row
    const updatedData = currentData.map(row => {
        if (row.id === parseInt(aliasId)) {
            return {
                ...row,
                in_active_project: true,
                project_memberships: [...(row.project_memberships || []), newMembership]
            };
        }
        return row;
    });

    // Choose update method based on dirty state
    if (hadDirtyChanges) {
        // Preserve existing dirty state
        window.aliasTableRef?.current?.setTableData(updatedData);
    } else {
        // Silent update - no dirty state triggered
        window.aliasTableRef?.current?.updateTableDataSilently(updatedData);
    }
}
```

**Benefits**:
- ✅ No table flash (updates in place)
- ✅ No false dirty state when table is clean
- ✅ Preserves unsaved edits when table is dirty
- ✅ Clean, polished user experience

**Implementation Location**:
The `updateTableDataSilently()` method is exposed via `useImperativeHandle` in TanStackCRUDTable.jsx and can be called via the table ref from parent components.

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

## Dual Context System (Customer & Project Selection)

The application uses a dual-dropdown system in the navbar for context selection:

### Customer Dropdown
- Always visible
- Allows selecting active customer
- Includes "+ Create New Customer" option
- Stored in UserConfig per-user

### Project Dropdown
- Appears only when customer is selected
- Includes "-- None --" option (allows customer without project)
- Includes "+ Create New Project" option
- Auto-clears when switching customers
- Stored in UserConfig per-user

### Customer View vs Project View

**IMPORTANT ARCHITECTURE**:
- **Project View** is where ALL work happens (creating, editing, deleting entities)
- **Customer View** is READ-ONLY and shows committed/deployed data only
- Changes made in Project View are committed to Customer View when ready

**Customer View** (default):
- Shows entities that are either **committed** (`committed=True`) OR **not in any project**
- **READ-ONLY** - No creating, editing, or deleting allowed
- Displays stable, finalized production data
- **IMPORTANT**: Hides uncommitted work-in-progress from projects
- Uses regular API endpoints with commit/membership filtering
- No field highlighting
- Banner displays: "Customer View is read-only. Switch to Project View to edit cells."

**Project View** (requires active project):
- Shows ONLY entities in the active project (via junction tables)
- **EDITABLE** - This is where all work happens (based on user permissions)
- Create new entities, edit existing ones, mark for deletion
- Merges base entity data with field_overrides from project
- Highlights modified fields with blue background
- Uses `/project/{id}/view/` API endpoints
- Disabled if no active project selected
- Changes are committed to Customer View when ready

### Field Highlighting in Project View
- Modified fields show light blue background with left border
- Indicates field has overrides in project (stored in field_overrides JSON)
- Only fields that differ from base value are highlighted
- Legend displayed above table explaining highlighting

### Table Read-Only Behavior (ALL Tables)

**Implementation Pattern**:
All tables follow this consistent read-only logic:
```javascript
// Customer View is always read-only; Project View depends on permissions
const isReadOnly = projectFilter !== 'current' || !canEdit;
```

This ensures:
- **Customer View**: Always read-only (no Save/Add buttons, cells not editable)
- **Project View**: Editable only if user has edit permissions
- Banner notification in Customer View explains the read-only state

**Tables affected**: Alias, Zone, Fabric, Storage, Volume, Host, Port, Switch

### Customer View Filtering Logic

**Customer View shows entities that meet EITHER of these conditions:**
1. **Committed entities** (`committed=True`) - Finalized/deployed data
2. **Orphaned entities** (no project membership) - Not referenced by any project

**Backend Implementation:**
All entity list views apply this filter:
```python
from django.db.models import Q, Count

# Show entities that are either committed OR not in any project
entities = entities.annotate(
    project_count=Count('project_memberships')
).filter(
    Q(committed=True) | Q(project_count=0)
)
```

**What this means:**
- ✅ **Committed entities show in Customer View** - Regardless of which project created them
- ✅ **Entities not in any project show in Customer View** - Legacy data or manually created items
- ❌ **Uncommitted entities in projects are hidden** - Work-in-progress stays in Project View only
- When you create an entity in Project View, it's marked `committed=False` and added to the project
- Entity appears in Project View immediately, but not in Customer View until committed
- Once committed (`committed=True`), entity appears in Customer View

**Entities with this filtering:**
- Fabrics, Aliases, Zones, Switches (SAN entities)
- Storage, Volumes, Hosts, Ports (Storage entities)

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

7. **Styling pages and components**:
   - **CRITICAL**: Always read `THEME_SYSTEM_DOCUMENTATION.md` before styling any page or component
   - **NO EMOJIS**: Never use emojis in this project - always use SVG icons instead
   - Follow the Bootstrap Background Override Pattern for all new pages
   - Use custom alert classes (not Bootstrap's `.alert-*`) - see Theme-Aware Alert Styling Pattern section
   - **Use custom modal styling** (not Bootstrap's defaults) - see Modal Styling Pattern below
   - All pages must work in both light and dark themes
   - Key patterns to follow:
     - Wrap page in container with unique class name (e.g., `.my-page-name`)
     - Start CSS file with Bootstrap overrides (copy template from docs)
     - Use theme CSS variables for all colors (never hardcoded colors)
     - Use `var(--secondary-bg)` with 4px colored left border for alerts
     - Use `var(--secondary-bg)` for modal backgrounds (NEVER `var(--modal-bg)` which can be gray)
     - Use SVG icons, not emojis (emojis render inconsistently across platforms)
     - Test in both themes before committing
   - **Reference**: `/THEME_SYSTEM_DOCUMENTATION.md` (comprehensive styling guide)
   - **Examples**:
     - Bootstrap overrides: `/frontend/src/styles/project-summary.css`
     - Alert styling: `/frontend/src/styles/backup.css` (search for `backup-scheduler-*-alert`)
     - Modal styling: `/frontend/src/pages/ImportMonitor.css` (search for `MODALS`)
     - SVG icons: `/frontend/src/pages/ProjectSummary.jsx` (see `getActionIcon` function)

   ### Modal Styling Pattern (REQUIRED for all modals)

   Bootstrap modals have gray/white backgrounds by default that don't respect dark themes.
   **ALWAYS** add these CSS overrides when using React Bootstrap `<Modal>`:

   ```css
   /* Modals are rendered via React portals OUTSIDE page containers.
    * These styles must be global (not scoped to your page class).
    * Use var(--secondary-bg) - NEVER var(--modal-bg) or var(--color-canvas-overlay) */

   .modal-content {
     background-color: var(--secondary-bg) !important;
     background-image: none !important;
     background: var(--secondary-bg) !important;
     border: 1px solid var(--color-border-default) !important;
     border-radius: var(--radius-lg) !important;
   }

   .modal-header {
     background-color: var(--secondary-bg) !important;
     background-image: none !important;
     background: var(--secondary-bg) !important;
     border-bottom: 1px solid var(--color-border-default) !important;
   }

   .modal-body {
     background-color: var(--secondary-bg) !important;
     background-image: none !important;
     background: var(--secondary-bg) !important;
     color: var(--primary-text) !important;
   }

   .modal-footer {
     background-color: var(--secondary-bg) !important;
     background-image: none !important;
     background: var(--secondary-bg) !important;
     border-top: 1px solid var(--color-border-default) !important;
   }

   .modal-title {
     color: var(--primary-text) !important;
   }

   .modal-body p, .modal-body li, .modal-body strong {
     color: var(--primary-text) !important;
   }

   /* Cards inside modals */
   .modal-body .card {
     background-color: var(--secondary-bg) !important;
     background: var(--secondary-bg) !important;
   }

   .modal-backdrop {
     background-color: #000000 !important;
   }

   .modal-backdrop.show {
     opacity: 0.6 !important;
   }
   ```

   **Key points:**
   - Use `var(--secondary-bg)` for ALL modal backgrounds
   - Include `background-image: none !important` to override Bootstrap gradients
   - Apply `!important` to all background properties
   - Style nested elements (p, li, strong, cards) explicitly
   - Modal backdrop should be solid black with 0.6 opacity

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
