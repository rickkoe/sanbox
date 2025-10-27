# Creating Dashboard Widgets

This guide explains how to create new dashboard widgets for the SANBox customizable dashboard system.

## Overview

Dashboard widgets consist of three main components:
1. **Backend API Endpoint** - Provides data for the widget
2. **Frontend React Component** - Renders the widget UI
3. **Database Widget Type** - Defines widget metadata and configuration

## Step-by-Step Guide

### Step 1: Create Backend API Endpoint

Create a new view function in `backend/core/dashboard_views.py` that returns the data your widget needs.

**Example:**

```python
@login_required
def widget_my_custom_data(request):
    """My Custom Widget Data"""
    try:
        customer_id = request.GET.get('customer_id')
        project_id = request.GET.get('project_id')

        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        # Query your data
        # Example: Get counts from your models
        data_count = MyModel.objects.filter(customer_id=customer_id).count()

        # Return JSON response
        return JsonResponse({
            'total_items': data_count,
            'custom_field': 'some_value'
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```

**Best Practices:**
- Always validate `customer_id` and/or `project_id` parameters
- Use try/except for error handling
- Return meaningful JSON data
- Keep queries efficient (use `.count()`, `.values()`, etc.)
- Filter data by customer/project to scope results properly

### Step 2: Add URL Route

Add a URL route for your new endpoint in `backend/core/urls.py`:

```python
# In the Widget Data Endpoints section
urlpatterns = [
    # ... existing routes ...

    # Your new widget endpoint
    path("widgets/my-custom-data/", widget_my_custom_data, name="widget-my-custom-data"),
]
```

Also import your new function at the top of the file:

```python
from .dashboard_views import (
    # ... existing imports ...
    widget_my_custom_data,  # Add your new function
)
```

### Step 3: Create Widget Type in Database

Create a Django migration to add your widget type to the database.

**Create migration file:** `backend/core/migrations/00XX_add_my_widget.py`

```python
from django.db import migrations

def create_widget_type(apps, schema_editor):
    """Create widget type"""
    WidgetType = apps.get_model('core', 'WidgetType')

    WidgetType.objects.get_or_create(
        name='my_custom_widget',
        defaults={
            'display_name': 'My Custom Widget',
            'description': 'Brief description of what this widget shows',
            'component_name': 'MyCustomWidget',  # Must match React component name
            'category': 'metrics',  # Options: metrics, charts, tables, health, activity, tools, custom
            'icon': 'FaChartLine',  # FontAwesome icon name (from react-icons/fa)
            'default_width': 4,      # Grid columns (1-12)
            'default_height': 300,   # Pixels
            'min_width': 3,
            'min_height': 250,
            'max_width': 8,
            'max_height': 500,
            'is_resizable': True,
            'requires_data_source': True,
            'config_schema': {},
            'is_active': True
        }
    )

def remove_widget_type(apps, schema_editor):
    """Remove widget type on rollback"""
    WidgetType = apps.get_model('core', 'WidgetType')
    WidgetType.objects.filter(name='my_custom_widget').delete()

class Migration(migrations.Migration):
    dependencies = [
        ('core', '00XX_previous_migration'),  # Update to latest migration
    ]

    operations = [
        migrations.RunPython(create_widget_type, remove_widget_type),
    ]
```

**Run the migration:**

```bash
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate core
```

**Widget Categories:**
- `metrics` - Key metric displays with numbers/stats
- `charts` - Charts and graphs (pie, bar, line, etc.)
- `tables` - Data tables and lists
- `health` - System health and status indicators
- `activity` - Activity logs and recent events
- `tools` - Interactive tools and utilities
- `custom` - Custom/miscellaneous widgets

### Step 4: Create Frontend Widget Component

Create your widget component in `frontend/src/components/dashboard/widgets/MyCustomWidget.js`:

```jsx
import React, { useState, useEffect, useContext } from 'react';
import { FaChartLine } from 'react-icons/fa';  // Match icon from widget type
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const MyCustomWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Don't fetch data in edit mode
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/my-custom-data/', {
          params: {
            customer_id: config?.customer?.id,
            project_id: config?.active_project?.id
          }
        });
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (config?.customer?.id) {
      fetchData();
    }
  }, [config?.customer?.id, config?.active_project?.id, editMode]);

  // Edit mode preview
  if (editMode) {
    return (
      <div className="widget-preview my-custom-widget">
        <div className="widget-header">
          <h4>My Custom Widget</h4>
        </div>
        <div className="widget-preview-content">
          <div className="stat-value">42</div>
          <div className="stat-label">Preview Data</div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="widget-loading my-custom-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="widget-error my-custom-widget">
        <span>{error}</span>
      </div>
    );
  }

  // Main widget render
  return (
    <div className="my-custom-widget">
      <div className="widget-header">
        <FaChartLine className="header-icon" />
        <h4>{widget?.title || 'My Custom Widget'}</h4>
      </div>

      <div className="widget-content">
        <div className="stat-item">
          <div className="stat-value">{data?.total_items || 0}</div>
          <div className="stat-label">Total Items</div>
        </div>

        {/* Add your custom UI here */}
        <div className="info-row">
          <span className="info-label">Custom Field</span>
          <span className="info-value">{data?.custom_field}</span>
        </div>
      </div>
    </div>
  );
};

export default MyCustomWidget;
```

**Widget Component Structure:**

Required elements:
- `editMode` preview (shows placeholder when adding widget)
- `loading` state (shows spinner while fetching)
- `error` state (shows error message if fetch fails)
- Main render with actual data

**Available CSS Classes:**

From `WidgetStyles.css`:
- `.widget-header` - Header with icon and title
- `.widget-content` - Main content area
- `.stat-item` - Stat display box
- `.stat-value` - Large number display
- `.stat-label` - Label under stat
- `.stat-grid` - Grid layout for multiple stats
- `.stat-grid-2x2` - 2x2 grid
- `.stat-grid-3` - 3 column grid
- `.info-row` - Key-value row
- `.progress-bar-container` - Progress bar
- `.activity-list` - Activity/log list
- `.type-distribution` - Type breakdown list
- `.capacity-row` - Capacity display row

### Step 5: Register Widget in WidgetRenderer

Update `frontend/src/components/dashboard/WidgetRenderer.js`:

**Add import:**

```jsx
import MyCustomWidget from './widgets/MyCustomWidget';
```

**Add case to switch statement:**

```jsx
// Render based on widget type
switch (widget.widget_type.component_name) {
  // ... existing cases ...

  case 'MyCustomWidget':
    return <MyCustomWidget widget={widget} editMode={editMode} compact={compact} />;

  default:
    return <GenericWidget widget={widget} data={data} compact={compact} />;
}
```

### Step 6: Test Your Widget

1. **Restart Frontend** (if needed):
   ```bash
   docker-compose -f docker-compose.dev.yml restart frontend
   ```

2. **Navigate to Dashboard**:
   - Go to `http://localhost:3000/`
   - Click "Edit" button
   - Click "Manage Widgets"

3. **Add Your Widget**:
   - Find your widget in the appropriate category
   - Click "Add" button
   - Widget should appear on dashboard

4. **Verify**:
   - Check that data loads correctly
   - Verify it updates with customer/project changes
   - Test resize and drag functionality
   - Check error handling (try with invalid data)

## Common Widget Patterns

### Simple Metric Widget

Shows a single number with label:

```jsx
<div className="stat-item">
  <FaIcon className="stat-icon" />
  <div className="stat-value">{data?.count || 0}</div>
  <div className="stat-label">Label</div>
</div>
```

### Multiple Stats Grid

Shows multiple stats in a grid:

```jsx
<div className="stat-grid stat-grid-2x2">
  <div className="stat-item">
    <div className="stat-value">{data?.total}</div>
    <div className="stat-label">Total</div>
  </div>
  <div className="stat-item">
    <div className="stat-value">{data?.active}</div>
    <div className="stat-label">Active</div>
  </div>
  {/* More stats... */}
</div>
```

### Progress Bar

Shows progress with percentage:

```jsx
<div className="progress-section">
  <div className="progress-header">
    <span>Progress</span>
    <span>{data?.percentage}%</span>
  </div>
  <div className="progress-bar-container">
    <div
      className="progress-bar"
      style={{ width: `${data?.percentage}%` }}
    >
      {data?.percentage > 10 && `${data?.percentage}%`}
    </div>
  </div>
</div>
```

### Chart Widget (with Recharts)

Shows a pie chart:

```jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

// In component:
const chartData = [
  { name: 'Type A', value: data?.typeA || 0 },
  { name: 'Type B', value: data?.typeB || 0 },
  { name: 'Type C', value: data?.typeC || 0 }
];

return (
  <ResponsiveContainer width="100%" height={200}>
    <PieChart>
      <Pie
        data={chartData}
        cx="50%"
        cy="50%"
        outerRadius={60}
        fill="#8884d8"
        dataKey="value"
        label
      >
        {chartData.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
);
```

### Activity List

Shows recent activity:

```jsx
<div className="activity-list">
  {data?.activities?.map((activity, index) => (
    <div key={index} className="activity-item">
      <FaIcon className="activity-icon" />
      <div className="activity-details">
        <div className="activity-name">{activity.name}</div>
        <div className="activity-meta">
          <span>{activity.user}</span>
          <span>{activity.timestamp}</span>
        </div>
      </div>
    </div>
  ))}
</div>
```

## Widget Configuration Options

### Adding Configuration Schema

Widgets can have configurable options. Define them in the widget type:

```python
WidgetType.objects.get_or_create(
    name='my_widget',
    defaults={
        # ... other fields ...
        'config_schema': {
            'show_details': {
                'type': 'boolean',
                'label': 'Show Details',
                'default': True
            },
            'refresh_rate': {
                'type': 'number',
                'label': 'Refresh Rate (seconds)',
                'default': 30,
                'min': 10,
                'max': 300
            },
            'display_mode': {
                'type': 'select',
                'label': 'Display Mode',
                'default': 'compact',
                'options': ['compact', 'detailed', 'minimal']
            }
        }
    }
)
```

### Using Configuration in Widget

Access config values in your widget component:

```jsx
const MyWidget = ({ widget, editMode }) => {
  const showDetails = widget?.config?.show_details ?? true;
  const displayMode = widget?.config?.display_mode || 'compact';

  return (
    <div className="my-widget">
      {/* Use config values */}
      {showDetails && <DetailedView />}
      <CompactView mode={displayMode} />
    </div>
  );
};
```

## Troubleshooting

### Widget Not Appearing in Marketplace

**Check:**
1. Migration ran successfully (`docker-compose -f docker-compose.dev.yml exec backend python manage.py showmigrations core`)
2. Widget type `is_active=True` in database
3. Frontend restarted after adding new code

### Data Not Loading

**Check:**
1. API endpoint URL is correct
2. Backend view function has `@login_required` decorator
3. URL is added to `backend/core/urls.py`
4. Customer/project IDs are being passed correctly
5. Check browser console for errors
6. Check backend logs: `docker-compose -f docker-compose.dev.yml logs backend`

### Compilation Errors

**Check:**
1. All imports are correct
2. Component export matches widget type `component_name`
3. No syntax errors (use `try {` not `try:`)
4. All JSX tags are properly closed
5. Check frontend logs: `docker-compose -f docker-compose.dev.yml logs frontend`

### Widget Shows Error State

**Check:**
1. Backend view returns proper JSON format
2. Error handling in try/catch is working
3. Database queries are valid
4. Required fields exist in models
5. API endpoint returns data for test customer/project

## Advanced Topics

### Custom Data Filters

Allow users to filter widget data:

```python
# In widget type
'config_schema': {
    'status_filter': {
        'type': 'select',
        'label': 'Status Filter',
        'options': ['all', 'active', 'inactive'],
        'default': 'all'
    }
}
```

```python
# In backend view
status_filter = request.GET.get('status_filter', 'all')
queryset = MyModel.objects.filter(customer_id=customer_id)

if status_filter != 'all':
    queryset = queryset.filter(status=status_filter)
```

### Auto-Refresh

Widgets auto-refresh based on dashboard settings. To customize:

```jsx
useEffect(() => {
  if (editMode) return;

  const fetchData = async () => { /* ... */ };

  // Initial fetch
  fetchData();

  // Custom refresh interval (overrides dashboard default)
  const customInterval = widget?.refresh_interval || 60; // 60 seconds
  const intervalId = setInterval(fetchData, customInterval * 1000);

  return () => clearInterval(intervalId);
}, [config?.customer?.id, editMode, widget?.refresh_interval]);
```

### Caching Backend Data

For expensive queries, add caching:

```python
from django.core.cache import cache

@login_required
def widget_expensive_data(request):
    customer_id = request.GET.get('customer_id')
    cache_key = f"widget_expensive_data_{customer_id}"

    # Try cache first
    cached_data = cache.get(cache_key)
    if cached_data:
        return JsonResponse(cached_data)

    # Expensive query
    data = perform_expensive_calculation()

    # Cache for 5 minutes
    cache.set(cache_key, data, 300)

    return JsonResponse(data)
```

## Example: Complete Simple Widget

Here's a complete example of a simple widget that shows fabric count:

**Backend** (`backend/core/dashboard_views.py`):
```python
@login_required
def widget_fabric_count(request):
    try:
        customer_id = request.GET.get('customer_id')
        if not customer_id:
            return JsonResponse({'error': 'customer_id required'}, status=400)

        total = Fabric.objects.filter(customer_id=customer_id).count()
        active = Fabric.objects.filter(customer_id=customer_id, exists=True).count()

        return JsonResponse({
            'total': total,
            'active': active,
            'inactive': total - active
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
```

**Frontend** (`frontend/src/components/dashboard/widgets/FabricCountWidget.js`):
```jsx
import React, { useState, useEffect, useContext } from 'react';
import { FaLayerGroup } from 'react-icons/fa';
import axios from 'axios';
import { ConfigContext } from '../../../context/ConfigContext';
import './WidgetStyles.css';

const FabricCountWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (editMode) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/widgets/fabric-count/', {
          params: { customer_id: config?.customer?.id }
        });
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (config?.customer?.id) {
      fetchData();
    }
  }, [config?.customer?.id, editMode]);

  if (editMode) {
    return (
      <div className="widget-preview fabric-count-widget">
        <div className="widget-header"><h4>Fabric Count</h4></div>
        <div className="widget-preview-content">
          <div className="stat-value">5</div>
          <div className="stat-label">Fabrics</div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="widget-loading fabric-count-widget">
        <div className="spinner"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-error fabric-count-widget">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="fabric-count-widget">
      <div className="widget-header">
        <FaLayerGroup className="header-icon" />
        <h4>{widget?.title || 'Fabric Count'}</h4>
      </div>
      <div className="widget-content">
        <div className="stat-grid stat-grid-3">
          <div className="stat-item">
            <div className="stat-value">{data?.total || 0}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data?.active || 0}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data?.inactive || 0}</div>
            <div className="stat-label">Inactive</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricCountWidget;
```

## Best Practices

1. **Always validate input parameters** in backend views
2. **Handle errors gracefully** with try/catch blocks
3. **Show loading states** while fetching data
4. **Provide edit mode previews** with sample data
5. **Use existing CSS classes** from WidgetStyles.css for consistency
6. **Keep queries efficient** - use aggregations, count(), values()
7. **Scope data properly** - always filter by customer/project
8. **Test with empty data** - handle zero/null cases
9. **Use meaningful widget names** - clear and descriptive
10. **Document your widget** - add comments for complex logic

## Additional Resources

- **Existing Widgets**: Check `frontend/src/components/dashboard/widgets/` for examples
- **Widget Styles**: See `frontend/src/components/dashboard/widgets/WidgetStyles.css` for available CSS classes
- **Recharts Documentation**: https://recharts.org/ for chart components
- **React Icons**: https://react-icons.github.io/react-icons/icons/fa/ for available icons

## Support

For issues or questions about widget development:
- Check existing widgets for examples
- Review backend logs for API errors
- Check browser console for frontend errors
- Verify database migrations ran successfully
