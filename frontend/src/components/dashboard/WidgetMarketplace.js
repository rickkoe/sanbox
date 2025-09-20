import React, { useState, useEffect } from 'react';
import { 
  FaTimes, FaSearch, FaFilter, FaPlus, FaCheckCircle,
  FaChartBar, FaTable, FaHeart, FaClock, FaTools,
  FaDatabase, FaNetworkWired, FaServer, FaChartLine,
  FaExclamationTriangle, FaUsers, FaHdd, FaStar,
  FaEye, FaDownload, FaTags, FaSort, FaTh, FaBars
} from 'react-icons/fa';
import axios from 'axios';
import './WidgetMarketplace.css';

export const WidgetMarketplace = ({ onAddWidget, onRemoveWidget, onClose, existingWidgets = [] }) => {
  const [widgetTypes, setWidgetTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [recentlyAdded, setRecentlyAdded] = useState(new Set()); // Track recently added widgets
  const [previewWidget, setPreviewWidget] = useState(null); // Track which widget is being previewed

  // Fetch widget types from API
  useEffect(() => {
    const fetchWidgetTypes = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/core/dashboard-v2/widget-types/');
        setWidgetTypes(response.data.widget_types || []);
      } catch (err) {
        setError('Failed to load widget types');
        console.error('Error fetching widget types:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgetTypes();
  }, []);

  // Get categories with counts
  const categories = [
    { key: 'all', label: 'All Widgets', count: widgetTypes.length },
    ...Object.entries(
      widgetTypes.reduce((acc, widget) => {
        acc[widget.category] = (acc[widget.category] || 0) + 1;
        return acc;
      }, {})
    ).map(([key, count]) => ({
      key,
      label: getCategoryLabel(key),
      count,
      icon: getCategoryIcon(key)
    }))
  ];

  // Filter and sort widgets
  const filteredWidgets = widgetTypes
    .filter(widget => {
      const matchesSearch = widget.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           widget.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || widget.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.usage_count - a.usage_count; // Mock usage count
        case 'name':
          return a.display_name.localeCompare(b.display_name);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        default:
          return 0;
      }
    });

  const handleAddWidget = (widgetType) => {
    try {
      // Find a good position for the new widget
      const position = findOptimalPosition(existingWidgets, widgetType);
      onAddWidget(widgetType, position);
      
      // Track recently added widget for visual feedback
      setRecentlyAdded(prev => new Set([...prev, widgetType.name]));
      
      // Clear the "recently added" status after 3 seconds
      setTimeout(() => {
        setRecentlyAdded(prev => {
          const newSet = new Set(prev);
          newSet.delete(widgetType.name);
          return newSet;
        });
      }, 3000);
    } catch (error) {
      console.error('WidgetMarketplace: Error in handleAddWidget:', error);
    }
  };

  const handleRemoveWidget = (widgetType) => {
    try {
      // Find the existing widget of this type
      const existingWidget = existingWidgets.find(w => w.widget_type.name === widgetType.name);
      if (existingWidget && onRemoveWidget) {
        onRemoveWidget(existingWidget.id);
      }
    } catch (error) {
      console.error('WidgetMarketplace: Error in handleRemoveWidget:', error);
    }
  };

  const handleWidgetAction = (widgetType, isInstalled) => {
    if (isInstalled) {
      handleRemoveWidget(widgetType);
    } else {
      handleAddWidget(widgetType);
    }
  };

  if (loading) {
    return (
      <div className="widget-marketplace">
        <div className="marketplace-content">
          <div className="marketplace-header">
            <h2>Widget Manager</h2>
            <button onClick={onClose} className="close-btn">
              <FaTimes />
            </button>
          </div>
          <div className="marketplace-loading">
            <div className="loading-spinner"></div>
            <p>Loading widgets...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="widget-marketplace">
        <div className="marketplace-content">
          <div className="marketplace-header">
            <h2>Widget Manager</h2>
            <button onClick={onClose} className="close-btn">
              <FaTimes />
            </button>
          </div>
          <div className="marketplace-error">
            <FaExclamationTriangle />
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-marketplace">
      <div className="marketplace-content">
        <div className="marketplace-header">
          <h2>Widget Manager</h2>
          <div className="header-stats">
            <span>{filteredWidgets.length} widgets available</span>
          </div>
          <button onClick={onClose} className="close-btn">
            <FaTimes />
          </button>
        </div>
        
        {/* Main Content */}
        <div className="marketplace-body">
          {/* Sidebar Filters */}
          <div className="marketplace-sidebar">
            <div className="search-section">
              <div className="search-box">
                <FaSearch />
                <input
                  type="text"
                  placeholder="Search widgets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="filter-section">
              <h3><FaFilter /> Categories</h3>
              <div className="category-list">
                {categories.map(category => (
                  <button
                    key={category.key}
                    className={`category-item ${selectedCategory === category.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.key)}
                  >
                    {category.icon && <category.icon />}
                    <span>{category.label}</span>
                    <span className="count">{category.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sort-section">
              <h3><FaSort /> Sort By</h3>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="popular">Most Popular</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Widget Grid */}
          <div className="marketplace-main">
            <div className="marketplace-toolbar">
              <div className="view-controls">
                <button
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <FaTh /> Grid
                </button>
                <button
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <FaBars /> List
                </button>
              </div>
              <div className="results-info">
                Showing {filteredWidgets.length} widgets
              </div>
            </div>

            <div className={`widget-grid ${viewMode}`}>
              {filteredWidgets.map(widget => (
                <WidgetCard
                  key={widget.name}
                  widget={widget}
                  onAction={(isInstalled) => handleWidgetAction(widget, isInstalled)}
                  onPreview={setPreviewWidget}
                  isInstalled={existingWidgets.some(w => w.widget_type.name === widget.name)}
                  isRecentlyAdded={recentlyAdded.has(widget.name)}
                  viewMode={viewMode}
                />
              ))}
            </div>

            {filteredWidgets.length === 0 && (
              <div className="no-results">
                <FaSearch className="no-results-icon" />
                <h3>No widgets found</h3>
                <p>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Widget Preview Modal - Rendered outside marketplace modal */}
      {previewWidget && (
        <WidgetPreview
          widget={previewWidget}
          onClose={() => setPreviewWidget(null)}
          onAction={(isInstalled) => {
            if (isInstalled) {
              handleRemoveWidget(previewWidget);
            } else {
              handleAddWidget(previewWidget, findOptimalPosition(existingWidgets, previewWidget));
            }
          }}
          isInstalled={existingWidgets.some(w => w.widget_type.name === previewWidget.name)}
        />
      )}
    </div>
  );
};

// Individual Widget Card Component
const WidgetCard = ({ widget, onAction, isInstalled, isRecentlyAdded, viewMode, onPreview }) => {

  const categoryColor = getCategoryColor(widget.category);
  const IconComponent = getWidgetIcon(widget.icon);

  if (viewMode === 'list') {
    return (
      <div className="widget-card list-mode">
        <div className="widget-icon" style={{ backgroundColor: categoryColor }}>
          <IconComponent />
        </div>
        <div className="widget-info">
          <h4>{widget.display_name}</h4>
          <p>{widget.description}</p>
          <div className="widget-meta">
            <span className="category">{getCategoryLabel(widget.category)}</span>
            <span className="size">{widget.default_width}×{widget.default_height}</span>
          </div>
        </div>
        <div className="widget-actions">
          <button
            onClick={() => onPreview(widget)}
            className="btn btn-outline-secondary"
            title="Preview"
          >
            <FaEye />
          </button>
          <button
            onClick={() => onAction(isInstalled)}
            className={`btn ${isInstalled ? 'btn-success' : 'btn-primary'} ${isRecentlyAdded ? 'recently-added' : ''}`}
            title={isInstalled ? 'Remove from dashboard' : 'Add to dashboard'}
          >
            {isInstalled ? <FaCheckCircle /> : <FaPlus />}
            {isRecentlyAdded ? 'Added!' : isInstalled ? 'Remove' : 'Add'}
          </button>
        </div>

      </div>
    );
  }

  return (
    <div className="widget-card grid-mode">
      <div className="widget-preview">
        <div className="widget-icon" style={{ backgroundColor: categoryColor }}>
          <IconComponent />
        </div>
        {widget.is_popular && (
          <div className="popular-badge">
            <FaStar /> Popular
          </div>
        )}
      </div>

      <div className="widget-details">
        <h4>{widget.display_name}</h4>
        <p>{widget.description}</p>
        
        <div className="widget-features">
          {widget.is_resizable && <span className="feature">Resizable</span>}
          {widget.requires_data_source && <span className="feature">Real-time</span>}
          <span className="feature">{getCategoryLabel(widget.category)}</span>
        </div>

        <div className="widget-specs">
          <span>Default: {widget.default_width}×{widget.default_height}</span>
          <span>Min: {widget.min_width}×{widget.min_height}</span>
        </div>
      </div>

      <div className="widget-actions">
        <button
          onClick={() => onPreview(widget)}
          className="btn btn-outline-secondary btn-sm"
        >
          <FaEye /> Preview
        </button>
        <button
          onClick={() => onAction(isInstalled)}
          className={`btn btn-sm ${isInstalled ? 'btn-success' : 'btn-primary'} ${isRecentlyAdded ? 'recently-added' : ''}`}
        >
          {isInstalled ? <FaCheckCircle /> : <FaPlus />}
          {isRecentlyAdded ? 'Added!' : isInstalled ? 'Remove' : 'Add'}
        </button>
      </div>

    </div>
  );
};

// Widget Preview Modal
const WidgetPreview = ({ widget, onClose, onAction, isInstalled }) => (
  <div className="widget-preview-modal">
    <div className="preview-content">
      <div className="preview-header">
        <h3>{widget.display_name}</h3>
        <button onClick={onClose} className="close-btn">
          <FaTimes />
        </button>
      </div>
      
      <div className="preview-body">
        <div className="preview-mockup">
          {/* Widget mockup based on type */}
          <WidgetMockup widget={widget} />
        </div>
        
        <div className="preview-details">
          <p>{widget.description}</p>
          
          <div className="detail-group">
            <h4>Specifications</h4>
            <ul>
              <li>Category: {getCategoryLabel(widget.category)}</li>
              <li>Default Size: {widget.default_width}×{widget.default_height}</li>
              <li>Resizable: {widget.is_resizable ? 'Yes' : 'No'}</li>
              <li>Data Source: {widget.requires_data_source ? 'Required' : 'Static'}</li>
            </ul>
          </div>
          
          {widget.config_schema && Object.keys(widget.config_schema).length > 0 && (
            <div className="detail-group">
              <h4>Configuration Options</h4>
              <ul>
                {Object.entries(widget.config_schema).map(([key, value]) => (
                  <li key={key}>{key}: {value.type || 'configurable'}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      <div className="preview-actions">
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
        <button
          onClick={() => { 
            onAction(isInstalled); 
            // Close modal only when removing, keep open when adding
            if (isInstalled) {
              onClose(); 
            }
          }}
          className={`btn ${isInstalled ? 'btn-success' : 'btn-primary'}`}
        >
          {isInstalled ? <FaCheckCircle /> : <FaPlus />}
          {isInstalled ? 'Remove from Dashboard' : 'Add to Dashboard'}
        </button>
      </div>
    </div>
  </div>
);

// Widget Mockup Component
const WidgetMockup = ({ widget }) => {
  const IconComponent = getWidgetIcon(widget.icon);
  
  return (
    <div className="widget-mockup">
      <div className="mockup-header">
        <IconComponent />
        <span>{widget.display_name}</span>
      </div>
      <div className="mockup-content">
        {widget.category === 'metrics' && <MetricMockup />}
        {widget.category === 'charts' && <ChartMockup />}
        {widget.category === 'tables' && <TableMockup />}
        {widget.category === 'health' && <HealthMockup />}
        {widget.category === 'activity' && <ActivityMockup />}
        {widget.category === 'tools' && <ToolMockup />}
      </div>
    </div>
  );
};

// Mockup components for different widget types
const MetricMockup = () => (
  <div className="metric-mockup">
    <div className="metric-value">142</div>
    <div className="metric-label">Active Systems</div>
    <div className="metric-trend">+12% this month</div>
  </div>
);

const ChartMockup = () => (
  <div className="chart-mockup">
    <div className="chart-bars">
      {[40, 70, 45, 85, 60].map((height, i) => (
        <div key={i} className="chart-bar" style={{ height: `${height}%` }} />
      ))}
    </div>
  </div>
);

const TableMockup = () => (
  <div className="table-mockup">
    <div className="table-header">Name | Status | Capacity</div>
    <div className="table-row">System-01 | Online | 75%</div>
    <div className="table-row">System-02 | Warning | 89%</div>
    <div className="table-row">System-03 | Online | 45%</div>
  </div>
);

const HealthMockup = () => (
  <div className="health-mockup">
    <div className="health-status good">System Health: Good</div>
    <div className="health-items">
      <div className="health-item">✓ Storage Online</div>
      <div className="health-item">✓ Network Stable</div>
      <div className="health-item">⚠ High Utilization</div>
    </div>
  </div>
);

const ActivityMockup = () => (
  <div className="activity-mockup">
    <div className="activity-item">Import completed - 2 min ago</div>
    <div className="activity-item">Zone created - 5 min ago</div>
    <div className="activity-item">System added - 10 min ago</div>
  </div>
);

const ToolMockup = () => (
  <div className="tool-mockup">
    <button className="tool-btn">Quick Action</button>
    <button className="tool-btn">Configure</button>
    <button className="tool-btn">Export</button>
  </div>
);

// Helper functions
const findOptimalPosition = (existingWidgets, widgetType) => {
  // Simple algorithm to find next available position
  const positions = existingWidgets.map(w => ({ x: w.position_x, y: w.position_y, w: w.width, h: w.height }));
  
  // Try to place at (0,0) first, then find next available spot
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x <= 12 - widgetType.default_width; x++) {
      const overlaps = positions.some(pos => 
        x < pos.x + pos.w && x + widgetType.default_width > pos.x &&
        y < pos.y + 1 && y + 1 > pos.y
      );
      
      if (!overlaps) {
        return { x, y };
      }
    }
  }
  
  return { x: 0, y: existingWidgets.length };
};

const getCategoryLabel = (category) => {
  const labels = {
    metrics: 'Key Metrics',
    charts: 'Charts & Graphs',
    tables: 'Data Tables',
    health: 'System Health',
    activity: 'Activity & Logs',
    tools: 'Quick Tools',
    custom: 'Custom Widgets'
  };
  return labels[category] || category;
};

const getCategoryIcon = (category) => {
  const icons = {
    metrics: FaChartLine,
    charts: FaChartBar,
    tables: FaTable,
    health: FaHeart,
    activity: FaClock,
    tools: FaTools,
    custom: FaStar
  };
  return icons[category] || FaStar;
};

const getCategoryColor = (category) => {
  const colors = {
    metrics: '#3b82f6',
    charts: '#10b981',
    tables: '#f59e0b',
    health: '#ef4444',
    activity: '#8b5cf6',
    tools: '#6b7280',
    custom: '#ec4899'
  };
  return colors[category] || '#6b7280';
};

const getWidgetIcon = (iconName) => {
  const icons = {
    FaChartLine,
    FaChartBar,
    FaTable,
    FaHeart,
    FaClock,
    FaTools,
    FaDatabase,
    FaNetworkWired,
    FaServer,
    FaUsers,
    FaHdd,
    FaExclamationTriangle
  };
  return icons[iconName] || FaStar;
};