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
- **Customizable Dashboards**: Drag-and-drop dashboard builder with custom templates

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

### 6. Customizable Dashboard System
- **Widget Marketplace**: Comprehensive library of customizable widgets
- **Drag-and-Drop Interface**: Intuitive widget positioning and layout management
- **Multiple View Modes**: Grid, list, and card views for optimal organization
- **Theme System**: Professional themes with CSS variable customization
- **Dashboard Presets**: Pre-configured templates for quick setup
- **Custom Templates**: Save and share personalized dashboard layouts
  - Save current dashboard as custom template
  - Public/private template sharing
  - Template preview with visual layout representation
  - Theme inheritance (templates preserve user's chosen theme)
- **Real-time Data**: Auto-refreshing widgets with configurable intervals
- **User Personalization**: Per-user dashboard configurations and preferences
- **Analytics Tracking**: Usage metrics and dashboard performance monitoring

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

/api/core/dashboard-v2/  # Customizable Dashboard API
├── layouts/         # Dashboard layout management
├── widgets/         # Widget instance management
├── widget-types/    # Available widget types
├── themes/          # Theme management
├── presets/         # Dashboard presets/templates
└── analytics/       # Dashboard usage analytics
```

## Customizable Dashboard System

The Customizable Dashboard is a comprehensive, widget-based dashboard system that allows users to create personalized, data-driven dashboards with extensive customization options.

### Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Container                       │
├─────────────────────────────────────────────────────────────┤
│  Header: Theme Selector, View Modes, Edit Controls          │
├─────────────────────────────────────────────────────────────┤
│  Toolbar (Edit Mode): Widget Manager, Presets, Config       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Widget    │ │   Widget    │ │   Widget    │            │
│  │  (Metric)   │ │  (Chart)    │ │  (Table)    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │   Widget    │ │   Widget    │                            │
│  │ (Health)    │ │ (Activity)  │                            │
│  └─────────────┘ └─────────────┘                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Footer (Edit Mode): Stats, Grid Info, Usage Tips          │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. Dashboard Models (Backend)

Located in `backend/core/models.py`:

```python
# Core dashboard models
class DashboardLayout(models.Model):
    """Main dashboard configuration per user"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dashboard_layouts')
    customer = models.ForeignKey('customers.Customer', on_delete=models.CASCADE)
    name = models.CharField(max_length=200, default='My Dashboard')
    theme = models.CharField(max_length=50, default='modern')
    grid_columns = models.IntegerField(default=12)
    auto_refresh = models.BooleanField(default=True)
    refresh_interval = models.IntegerField(default=30)  # seconds

class WidgetType(models.Model):
    """Available widget types in the marketplace"""
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    category = models.CharField(max_length=50)  # metrics, charts, tables, health, etc.
    icon = models.CharField(max_length=50)
    description = models.TextField()
    default_width = models.IntegerField(default=4)
    default_height = models.IntegerField(default=4)
    
class DashboardWidget(models.Model):
    """Individual widget instances on a dashboard"""
    layout = models.ForeignKey(DashboardLayout, on_delete=models.CASCADE, related_name='widgets')
    widget_type = models.ForeignKey(WidgetType, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)
    width = models.IntegerField(default=4)
    height = models.IntegerField(default=4)
    config = models.JSONField(default=dict)
```

#### 2. Frontend Components

**Main Dashboard Component**: `frontend/src/pages/CustomizableDashboard.js`
- Handles dashboard state management
- Manages edit mode functionality
- Controls view switching (grid/list/cards)
- Integrates with backend APIs

**Widget Marketplace**: `frontend/src/components/dashboard/WidgetMarketplace.js`
- Comprehensive widget library browser
- Search and filter functionality
- Widget preview system
- Add/remove widget management

**Grid Layout Renderer**: `frontend/src/components/dashboard/GridLayoutRenderer.js`
- Drag-and-drop widget positioning
- Responsive grid system
- Multiple view mode support
- Real-time layout updates

**Theme System**: `frontend/src/components/dashboard/ThemeSelector.js`
- CSS variable-based theming
- Live theme preview
- Custom theme creation

### Dashboard API Endpoints

#### Layout Management
```bash
# Get user's dashboard layout
GET /api/core/dashboard-v2/layouts/

# Update dashboard configuration
PUT /api/core/dashboard-v2/layouts/{id}/
{
  "name": "Sales Dashboard",
  "theme": "dark",
  "auto_refresh": true,
  "refresh_interval": 60
}
```

#### Widget Management
```bash
# Get dashboard widgets
GET /api/core/dashboard-v2/widgets/?layout_id={layout_id}

# Add new widget
POST /api/core/dashboard-v2/widgets/
{
  "layout": 1,
  "widget_type": "storage_capacity_chart",
  "title": "Storage Capacity Overview",
  "position_x": 0,
  "position_y": 0,
  "width": 6,
  "height": 4,
  "config": {
    "chart_type": "pie",
    "show_legend": true
  }
}

# Update widget position/size
PUT /api/core/dashboard-v2/widgets/{id}/
{
  "position_x": 6,
  "position_y": 0,
  "width": 6,
  "height": 4
}

# Remove widget
DELETE /api/core/dashboard-v2/widgets/{id}/
```

#### Widget Types
```bash
# Get available widget types
GET /api/core/dashboard-v2/widget-types/
# Returns: Widget marketplace catalog with categories, descriptions, defaults

# Get widget types by category
GET /api/core/dashboard-v2/widget-types/?category=metrics
```

### Customization Guide

#### 1. Adding New Widget Types

**Step 1: Create Widget Type in Database**
```python
# Add to backend/core/management/commands/setup_dashboard.py
widget_types = [
    {
        'name': 'custom_metric_widget',
        'display_name': 'Custom Metric Display',
        'category': 'metrics',
        'icon': 'FaChartLine',
        'description': 'Display custom business metrics',
        'default_width': 4,
        'default_height': 3,
        'config_schema': {
            'metric_source': {'type': 'string', 'required': True},
            'update_interval': {'type': 'integer', 'default': 30}
        }
    }
]
```

**Step 2: Create Widget Component**
```jsx
// frontend/src/components/dashboard/widgets/CustomMetricWidget.js
import React, { useState, useEffect } from 'react';

export const CustomMetricWidget = ({ widget, config }) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Fetch widget data based on config
    fetchMetricData(config.metric_source);
  }, [config]);
  
  return (
    <div className="metric-widget">
      <div className="metric-header">
        <h4>{widget.title}</h4>
      </div>
      <div className="metric-value">
        {data?.value || 'Loading...'}
      </div>
      <div className="metric-label">
        {config.metric_label}
      </div>
    </div>
  );
};
```

**Step 3: Register Widget in Renderer**
```jsx
// frontend/src/components/dashboard/GridLayoutRenderer.js
const renderWidget = (widget) => {
  switch (widget.widget_type.name) {
    case 'custom_metric_widget':
      return <CustomMetricWidget widget={widget} config={widget.config} />;
    // ... other widget types
  }
};
```

#### 2. Creating Custom Themes

**Step 1: Define Theme Variables**
```css
/* frontend/src/components/dashboard/themes/custom-theme.css */
.theme-custom {
  /* Primary colors */
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --accent-color: #06b6d4;
  
  /* Background colors */
  --dashboard-bg: #f1f5f9;
  --card-bg: #ffffff;
  --sidebar-bg: #1e293b;
  
  /* Text colors */
  --text-primary: #0f172a;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;
  
  /* Border and shadow */
  --border-color: #e2e8f0;
  --card-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

**Step 2: Add Theme to Database**
```python
# Add to setup_dashboard.py
themes = [
    {
        'name': 'custom',
        'display_name': 'Custom Corporate',
        'description': 'Custom corporate branding theme',
        'css_variables': {
            'primary_color': '#6366f1',
            'secondary_color': '#8b5cf6',
            'dashboard_bg': '#f1f5f9'
        }
    }
]
```

#### 3. Dashboard Preset Creation

**Step 1: Define Preset Configuration**
```python
# Add to setup_dashboard.py
presets = [
    {
        'name': 'storage_overview',
        'display_name': 'Storage Overview Dashboard',
        'description': 'Complete storage infrastructure overview',
        'theme': 'modern',
        'widgets': [
            {
                'widget_type': 'storage_capacity_metric',
                'title': 'Total Capacity',
                'position_x': 0, 'position_y': 0,
                'width': 3, 'height': 3
            },
            {
                'widget_type': 'storage_utilization_chart',
                'title': 'Utilization Trends',
                'position_x': 3, 'position_y': 0,
                'width': 6, 'height': 4
            }
        ]
    }
]
```

### Integration with Backend Data

#### 1. Connecting Widgets to APIs

**Widget Data Sources**:
```jsx
// Example: Storage capacity widget
const StorageCapacityWidget = ({ widget, config }) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/storage/capacity-summary/', {
          params: {
            customer_id: config.customer_id,
            time_range: config.time_range || '30d'
          }
        });
        setData(response.data);
      } catch (error) {
        console.error('Failed to fetch storage data:', error);
      }
    };
    
    fetchData();
    
    // Auto-refresh based on dashboard settings
    const interval = setInterval(fetchData, widget.refresh_interval * 1000);
    return () => clearInterval(interval);
  }, [config, widget.refresh_interval]);
  
  return (
    <div className="storage-capacity-widget">
      {/* Widget content */}
    </div>
  );
};
```

#### 2. Real-time Data Updates

**WebSocket Integration** (Future Enhancement):
```jsx
// Example: Real-time metrics
const useRealtimeData = (endpoint, config) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/${endpoint}/`);
    
    ws.onmessage = (event) => {
      const newData = JSON.parse(event.data);
      setData(newData);
    };
    
    return () => ws.close();
  }, [endpoint]);
  
  return data;
};
```

### Advanced Customization

#### 1. Custom Widget Configuration

**Widget Config Schema**:
```python
# Backend: Define configurable options
config_schema = {
    'chart_type': {
        'type': 'select',
        'options': ['bar', 'line', 'pie', 'area'],
        'default': 'bar',
        'label': 'Chart Type'
    },
    'time_range': {
        'type': 'select',
        'options': ['1h', '1d', '7d', '30d'],
        'default': '7d',
        'label': 'Time Range'
    },
    'show_legend': {
        'type': 'boolean',
        'default': true,
        'label': 'Show Legend'
    }
}
```

**Frontend Configuration UI**:
```jsx
// Configuration modal for widgets
const WidgetConfigModal = ({ widget, onSave, onClose }) => {
  const [config, setConfig] = useState(widget.config);
  
  const renderConfigField = (field, schema) => {
    switch (schema.type) {
      case 'select':
        return (
          <select 
            value={config[field]} 
            onChange={(e) => setConfig({...config, [field]: e.target.value})}
          >
            {schema.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={config[field]}
            onChange={(e) => setConfig({...config, [field]: e.target.checked})}
          />
        );
      default:
        return (
          <input
            type="text"
            value={config[field]}
            onChange={(e) => setConfig({...config, [field]: e.target.value})}
          />
        );
    }
  };
  
  return (
    <div className="widget-config-modal">
      {/* Configuration form */}
    </div>
  );
};
```

#### 2. Dashboard Analytics

**Usage Tracking**:
```python
# Backend: Track dashboard usage
class DashboardAnalytics(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    dashboard = models.ForeignKey(DashboardLayout, on_delete=models.CASCADE)
    action = models.CharField(max_length=50)  # 'view', 'edit', 'widget_add', etc.
    timestamp = models.DateTimeField(auto_now_add=True)
    metadata = models.JSONField(default=dict)  # Additional context
```

### Deployment and Setup

#### 1. Initial Dashboard Setup

**Management Command**:
```bash
# Run setup command to populate widget types and themes
python manage.py setup_dashboard
```

**Manual Database Setup**:
```python
# Create basic widget types
python manage.py shell
from core.models import WidgetType

WidgetType.objects.create(
    name='storage_capacity_chart',
    display_name='Storage Capacity Chart',
    category='charts',
    icon='FaChartPie',
    description='Visual representation of storage capacity utilization',
    default_width=6,
    default_height=4
)
```

#### 2. Production Considerations

**Performance Optimization**:
- Enable Redis caching for widget data
- Implement lazy loading for heavy widgets
- Use pagination for data-heavy widgets
- Optimize API queries with proper indexing

**Security**:
- Validate widget configurations on backend
- Sanitize user inputs in widget configs
- Implement proper permissions for dashboard access
- Rate limit API calls from widgets

### Custom Dashboard Templates

The dashboard system supports saving and sharing custom templates, allowing users to preserve and distribute personalized dashboard layouts.

#### Creating Custom Templates

1. **Configure Your Dashboard**:
   ```bash
   # Arrange widgets in your preferred layout
   # Set widget sizes and positions
   # Configure widget settings
   ```

2. **Save as Template**:
   - Click the "Save as Template" button (📥 icon) in dashboard header
   - Enter template name and description
   - Choose public/private sharing option
   - Save template

3. **Template Features**:
   - **Theme Inheritance**: Templates preserve user's selected theme
   - **Widget Configuration**: All widget settings and positions are saved
   - **Sharing Options**: Make templates public for organization-wide access
   - **Creator Attribution**: Templates show who created them

#### Applying Templates

1. **Browse Templates**:
   - Click "Templates" button (📚 icon) in dashboard header
   - View system templates and custom templates
   - Custom templates display green "Custom" badge

2. **Preview Templates**:
   - Click "Preview" to see template layout
   - View widget arrangement and configuration
   - Check compatibility with current theme

3. **Apply Templates**:
   - Click "Apply Template" to use selected layout
   - Current dashboard is replaced with template configuration
   - User's theme preference is preserved

#### Template Management

**Database Models**:
```python
class DashboardPreset(models.Model):
    name = models.CharField(max_length=100, unique=True)
    display_name = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=50)
    layout_config = models.JSONField()  # Complete dashboard configuration
    is_system = models.BooleanField(default=True)
    is_public = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, null=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, null=True)
```

**API Endpoints**:
```bash
GET  /api/core/dashboard-v2/presets/?customer_id=123  # List templates
POST /api/core/dashboard-v2/templates/save/           # Save custom template
POST /api/core/dashboard-v2/presets/apply/           # Apply template
```

### Future Enhancements

#### 1. Advanced Features
- **Widget Sharing**: Share widgets between users
- **Template Import/Export**: File-based template exchange
- **Real-time Collaboration**: Multi-user dashboard editing
- **Custom Data Sources**: Connect to external APIs
- **Advanced Analytics**: Usage patterns and optimization suggestions

#### 2. Widget Ecosystem
- **Widget Marketplace**: Community-contributed widgets
- **Widget SDK**: Standardized widget development framework
- **Widget Testing**: Automated testing for custom widgets
- **Widget Versioning**: Manage widget updates and compatibility

This comprehensive dashboard system provides a solid foundation for creating powerful, customizable dashboards while maintaining scalability and extensibility for future development.

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

4. **Dashboard Operations**
```bash
# Seed system dashboard presets
python manage.py seed_dashboard_presets

# Seed widget types
python manage.py seed_dashboard_widgets

# Clear dashboard cache for customer
curl -X POST http://localhost:8000/api/core/dashboard/cache/clear/ \
  -H "Content-Type: application/json" \
  -d '{"customer_id": 1, "project_id": 1}'
```

**Custom Template Usage**:
- **Save Template**: Dashboard → Save as Template button → Fill form → Save
- **Apply Template**: Dashboard → Templates button → Select template → Apply
- **Manage Templates**: Templates are stored in `DashboardPreset` model
- **Share Templates**: Enable "Make Public" when saving template

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