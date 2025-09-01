import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, Search, ChevronDown, ChevronUp, Calendar, Hash, Type, Check } from 'lucide-react';
import axios from 'axios';
import { 
  createColumnMetadata, 
  getColumnUniqueValues, 
  generateServerFilters 
} from '../utils/columnFilterUtils';
import './AdvancedFilter.css';

const AdvancedFilter = ({
  columns,
  colHeaders,
  visibleColumns,
  quickSearch,
  setQuickSearch,
  onFilterChange,
  data = [],
  initialFilters = {},
  apiUrl = null,  // Add apiUrl for server-side unique values
  serverPagination = false,  // Add serverPagination flag
  dropdownSources = {}  // Add dropdown sources for better type detection
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeColumn, setActiveColumn] = useState(null);
  const [columnSearch, setColumnSearch] = useState('');
  
  // Cache for server-side unique values
  const [uniqueValuesCache, setUniqueValuesCache] = useState({});
  const [loadingColumns, setLoadingColumns] = useState({});
  
  // Create comprehensive column metadata for filtering
  const columnMetadata = useMemo(() => {
    return createColumnMetadata(columns, colHeaders, data, dropdownSources, visibleColumns);
  }, [columns, colHeaders, data, dropdownSources, visibleColumns]);

  // Synchronize activeFilters with initialFilters (from persisted configuration)
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      console.log('AdvancedFilter: Setting activeFilters from initialFilters:', initialFilters);
      setActiveFilters(initialFilters);
    }
  }, [initialFilters]);
  
  const filterButtonRef = useRef(null);
  const filterDropdownRef = useRef(null);

  // Calculate filter dropdown position
  const calculateFilterPosition = () => {
    if (!filterButtonRef.current) return { top: 0, left: 0 };
    
    const rect = filterButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const dropdownWidth = 320;
    const dropdownHeight = 400;
    
    let left = rect.left;
    let top = rect.bottom + 4;
    
    // Adjust horizontal position if dropdown would go off-screen
    if (left + dropdownWidth > viewportWidth) {
      left = viewportWidth - dropdownWidth - 16;
    }
    
    // Adjust vertical position if dropdown would go off-screen
    if (top + dropdownHeight > viewportHeight) {
      top = rect.top - dropdownHeight - 4;
    }
    
    return { top, left };
  };

  // Handle filter dropdown toggle
  const handleFilterToggle = () => {
    if (!showFilterDropdown) {
      const position = calculateFilterPosition();
      setFilterDropdownPosition(position);
    }
    setShowFilterDropdown(!showFilterDropdown);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target) &&
          filterButtonRef.current && !filterButtonRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
        setActiveColumn(null);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterDropdown]);

  // Fetch unique values from server for a specific column
  const fetchUniqueValues = async (columnIndex) => {
    const column = columns[columnIndex];
    if (!column || !apiUrl) return [];
    
    // Use cache if available
    const cacheKey = `${columnIndex}_${column.data}`;
    if (uniqueValuesCache[cacheKey]) {
      return uniqueValuesCache[cacheKey];
    }
    
    try {
      let fieldName = column.data;
      
      // Handle special field mappings (same as in useServerPagination)
      if (fieldName === 'fabric') {
        fieldName = 'fabric__name';
      } else if (fieldName === 'fabric_details.name') {
        fieldName = 'fabric__name';
      } else if (fieldName === 'storage' && !fieldName.includes('__')) {
        fieldName = 'storage__name';
      }
      
      // Build unique values API URL
      const separator = apiUrl.includes('?') ? '&' : '?';
      const uniqueValuesUrl = `${apiUrl}${separator}unique_values=${encodeURIComponent(fieldName)}`;
      
      console.log(`🔍 AdvancedFilter fetching unique values for ${fieldName}:`, uniqueValuesUrl);
      
      const response = await axios.get(uniqueValuesUrl);
      let uniqueValues = [];
      
      // Handle different response formats
      if (response.data.unique_values) {
        uniqueValues = response.data.unique_values;
      } else if (Array.isArray(response.data)) {
        uniqueValues = response.data;
      }
      
      // Convert to strings and handle boolean values properly
      const processedValues = uniqueValues
        .filter(value => value !== null && value !== undefined)
        .map(value => {
          if (typeof value === 'boolean') {
            return value ? 'True' : 'False';  // Convert booleans to string representation
          }
          return String(value).trim();
        })
        .filter(value => value !== '')
        .sort((a, b) => {
          // Put boolean values in a logical order
          if (a === 'True' && b === 'False') return -1;
          if (a === 'False' && b === 'True') return 1;
          // For other values, use normal sorting
          return a.localeCompare(b);
        });
      
      const finalValues = [...new Set(processedValues)];
      
      // Cache the result
      setUniqueValuesCache(prev => ({
        ...prev,
        [cacheKey]: finalValues
      }));
      
      console.log(`✅ AdvancedFilter got ${finalValues.length} unique values for ${fieldName}:`, finalValues);
      return finalValues;
      
    } catch (error) {
      console.error(`❌ AdvancedFilter failed to fetch unique values for ${column.data}:`, error);
      
      // Fallback to local data
      return getLocalUniqueValues(columnIndex);
    }
  };

  // Get unique values from local data using enhanced utilities
  const getLocalUniqueValues = (columnIndex) => {
    const columnMeta = columnMetadata.find(col => col.index === columnIndex);
    if (!columnMeta || !data || !Array.isArray(data)) return [];
    
    return getColumnUniqueValues(data, columnMeta, 100);
  };

  // Get unique values - uses server fetch for server pagination, local data otherwise
  const getUniqueValues = (columnIndex) => {
    if (serverPagination && apiUrl) {
      // For server pagination, return cached values if available, empty array otherwise
      const column = columns[columnIndex];
      if (!column) return [];
      
      const cacheKey = `${columnIndex}_${column.data}`;
      return uniqueValuesCache[cacheKey] || [];
    } else {
      // For client-side data, use the local implementation
      return getLocalUniqueValues(columnIndex);
    }
  };

  // Trigger unique values fetch when column is expanded
  const handleColumnToggle = async (columnIndex) => {
    const newActiveColumn = activeColumn === columnIndex ? null : columnIndex;
    setActiveColumn(newActiveColumn);
    
    // If opening a column and server pagination is enabled, fetch unique values
    if (newActiveColumn !== null && serverPagination && apiUrl) {
      const column = columns[columnIndex];
      const cacheKey = `${columnIndex}_${column.data}`;
      
      // Only fetch if not already cached and not already loading
      if (!uniqueValuesCache[cacheKey] && !loadingColumns[columnIndex]) {
        console.log(`📡 AdvancedFilter loading unique values for column ${columnIndex}...`);
        setLoadingColumns(prev => ({ ...prev, [columnIndex]: true }));
        
        try {
          await fetchUniqueValues(columnIndex);
        } catch (error) {
          console.error(`Failed to load unique values for column ${columnIndex}:`, error);
        } finally {
          setLoadingColumns(prev => ({ ...prev, [columnIndex]: false }));
        }
      }
    }
  };

  // Filter columns for dropdown using enhanced metadata - allow all columns, not just visible ones
  const getFilterableColumns = () => {
    return columnMetadata
      .filter(col => {
        // Allow read-only columns if they are numeric (like count fields) or specific useful read-only fields
        if (col.readOnly) {
          // Allow count columns, status fields, and other useful read-only fields for filtering
          const isFilterableReadOnly = col.type === 'number' || 
                                     col.data.includes('count') || 
                                     col.data.includes('status') ||
                                     col.data.includes('type') ||
                                     col.data === 'imported' ||
                                     col.data === 'updated';
          return isFilterableReadOnly;
        }
        return true; // Allow all non-read-only columns
      })
      .filter(col => {
        if (!columnSearch) return true;
        return col.header.toLowerCase().includes(columnSearch.toLowerCase());
      });
  };
  
  // Get icon for column type
  const getColumnTypeIcon = (columnType) => {
    switch (columnType) {
      case 'boolean': return <Check size={12} />;
      case 'number': return <Hash size={12} />;
      case 'datetime': return <Calendar size={12} />;
      default: return <Type size={12} />;
    }
  };

  // Handle column filter
  const handleColumnFilter = (columnIndex, filterType, value) => {
    const newFilters = { ...activeFilters };
    
    if (value === '' || value === null) {
      delete newFilters[columnIndex];
    } else {
      newFilters[columnIndex] = { type: filterType, value };
    }
    
    setActiveFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // Handle multiple value selection
  const handleValueToggle = (columnIndex, value) => {
    const newFilters = { ...activeFilters };
    const currentFilter = newFilters[columnIndex];
    
    if (currentFilter && currentFilter.type === 'multi_select') {
      // Toggle value in existing multi-select filter
      const currentValues = currentFilter.value || [];
      const valueIndex = currentValues.indexOf(value);
      
      if (valueIndex === -1) {
        // Add value (cumulative OR)
        currentFilter.value = [...currentValues, value];
      } else {
        // Remove value
        currentFilter.value = currentValues.filter(v => v !== value);
      }
      
      // Remove filter entirely if no values selected (show all data)
      if (currentFilter.value.length === 0) {
        delete newFilters[columnIndex];
      }
    } else {
      // No existing filter - create new filter with just this value
      newFilters[columnIndex] = { type: 'multi_select', value: [value] };
    }
    
    
    setActiveFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // Check if value is selected in multi-select filter
  const isValueSelected = (columnIndex, value) => {
    const filter = activeFilters[columnIndex];
    if (!filter || filter.type !== 'multi_select') {
      // No filter means no values are selected (no filtering applied)
      return false;
    }
    return filter.value && filter.value.includes(value);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters({});
    onFilterChange?.({});
  };

  // Get active filter count
  const activeFilterCount = Object.keys(activeFilters).length;

  const filterableColumns = getFilterableColumns();

  return (
    <div className="advanced-filter-container">
      {/* Quick Search */}
      <div className="advanced-search-input">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Quick search..."
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          className="search-field"
        />
        {quickSearch && (
          <button
            onClick={() => setQuickSearch('')}
            className="search-clear"
            title="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Advanced Filter Button */}
      <button
        ref={filterButtonRef}
        onClick={handleFilterToggle}
        className={`advanced-filter-button ${activeFilterCount > 0 ? 'has-filters' : ''}`}
        title="Advanced filters"
      >
        <Filter size={16} />
        <span className="filter-text">Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount}</span>
        )}
        {showFilterDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Filter Dropdown */}
      {showFilterDropdown && createPortal(
        <div
          ref={filterDropdownRef}
          className="advanced-filter-dropdown"
          style={{
            position: 'fixed',
            top: `${filterDropdownPosition.top}px`,
            left: `${filterDropdownPosition.left}px`,
            zIndex: 10000
          }}
        >
          <div className="filter-dropdown-header">
            <div className="filter-dropdown-title">
              <Filter size={16} />
              Advanced Filters
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="clear-all-button"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Column Search */}
          <div className="column-search-container">
            <Search size={14} className="column-search-icon" />
            <input
              type="text"
              placeholder="Search columns..."
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              className="column-search-input"
            />
          </div>

          {/* Columns List */}
          <div className="columns-list">
            {filterableColumns.length === 0 ? (
              <div className="no-columns">No matching columns found</div>
            ) : (
              filterableColumns.map((col) => {
                const hasFilter = activeFilters[col.index];
                const uniqueValues = getUniqueValues(col.index);
                
                return (
                  <div key={col.index} className="column-filter-item">
                    <button
                      onClick={() => handleColumnToggle(col.index)}
                      className={`column-filter-toggle ${hasFilter ? 'has-filter' : ''}`}
                    >
                      <div className="column-info">
                        {getColumnTypeIcon(col.type)}
                        <span className="column-name">{col.header}</span>
                        <span className="column-type-badge">{col.type}</span>
                      </div>
                      {hasFilter && (
                        <span className="filter-indicator">
                          {activeFilters[col.index].type === 'multi_select' 
                            ? `${activeFilters[col.index].value?.length || 0} selected`
                            : `${activeFilters[col.index].type}: ${activeFilters[col.index].value}`
                          }
                        </span>
                      )}
                      <ChevronDown 
                        size={12} 
                        className={`column-chevron ${activeColumn === col.index ? 'rotated' : ''}`}
                      />
                    </button>
                    
                    {activeColumn === col.index && (
                      <div className="column-filter-panel">
                        {/* Text Filter - Available for most types */}
                        {col.supportsTextFilter && (
                          <div className="filter-section">
                            <label className="filter-label">Text Filter</label>
                            <div className="text-filter-options">
                              <select
                                value={hasFilter && ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(activeFilters[col.index].type) 
                                  ? activeFilters[col.index].type : (col.type === 'number' ? 'equals' : 'contains')}
                                onChange={(e) => {
                                  const currentValue = hasFilter && ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(activeFilters[col.index].type) 
                                    ? activeFilters[col.index].value : '';
                                  handleColumnFilter(col.index, e.target.value, currentValue);
                                }}
                                className="filter-type-select"
                              >
                                {col.filterTypes
                                  .filter(type => ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(type))
                                  .map(type => (
                                    <option key={type} value={type}>
                                      {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </option>
                                  ))
                                }
                              </select>
                              <input
                                type="text"
                                placeholder="Enter filter value..."
                                value={hasFilter && ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(activeFilters[col.index].type) 
                                  ? activeFilters[col.index].value : ''}
                                onChange={(e) => {
                                  const filterType = hasFilter && ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(activeFilters[col.index].type) 
                                    ? activeFilters[col.index].type : (col.type === 'number' ? 'equals' : 'contains');
                                  handleColumnFilter(col.index, filterType, e.target.value);
                                }}
                                className="filter-input"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Number Range Filter */}
                        {col.type === 'number' && col.filterTypes.includes('range') && (
                          <div className="filter-section">
                            <label className="filter-label">Range Filter</label>
                            <div className="range-filter-inputs">
                              <input
                                type="number"
                                placeholder="Min"
                                value={hasFilter && activeFilters[col.index].type === 'range' && Array.isArray(activeFilters[col.index].value) 
                                  ? activeFilters[col.index].value[0] : ''}
                                onChange={(e) => {
                                  const currentRange = hasFilter && activeFilters[col.index].type === 'range' && Array.isArray(activeFilters[col.index].value)
                                    ? activeFilters[col.index].value : ['', ''];
                                  handleColumnFilter(col.index, 'range', [e.target.value, currentRange[1]]);
                                }}
                                className="range-input"
                              />
                              <span>to</span>
                              <input
                                type="number"
                                placeholder="Max"
                                value={hasFilter && activeFilters[col.index].type === 'range' && Array.isArray(activeFilters[col.index].value)
                                  ? activeFilters[col.index].value[1] : ''}
                                onChange={(e) => {
                                  const currentRange = hasFilter && activeFilters[col.index].type === 'range' && Array.isArray(activeFilters[col.index].value)
                                    ? activeFilters[col.index].value : ['', ''];
                                  handleColumnFilter(col.index, 'range', [currentRange[0], e.target.value]);
                                }}
                                className="range-input"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Value Selection */}
                        {col.supportsValueFilter && (
                          loadingColumns[col.index] ? (
                            <div className="filter-section">
                              <label className="filter-label">Loading values...</label>
                              <div className="loading-indicator">
                                <div className="spinner"></div>
                                <span>Fetching filter options...</span>
                              </div>
                            </div>
                          ) : uniqueValues.length > 0 && uniqueValues.length <= 50 ? (
                            <div className="filter-section">
                              <label className="filter-label">Select Values ({uniqueValues.length})</label>
                              <div className="values-list-checkboxes">
                                {uniqueValues.map((value, idx) => (
                                  <label key={idx} className="value-checkbox-item">
                                    <input
                                      type="checkbox"
                                      checked={isValueSelected(col.index, value)}
                                      onChange={() => handleValueToggle(col.index, value)}
                                      className="value-checkbox"
                                    />
                                    <span className="value-checkbox-label">{value}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ) : uniqueValues.length > 50 ? (
                            <div className="filter-section">
                              <div className="too-many-values">
                                Too many unique values ({uniqueValues.length}). Use text filter instead.
                              </div>
                            </div>
                          ) : null
                        )}
                        
                        {/* Clear Column Filter */}
                        {hasFilter && (
                          <button
                            onClick={() => handleColumnFilter(col.index, null, null)}
                            className="clear-column-filter"
                          >
                            <X size={12} />
                            Clear Filter
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdvancedFilter;