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
import '../GenericTableFast.css'; // Import action-btn styles

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
  
  // Local state for search input (separate from actual search value)
  const [searchInputValue, setSearchInputValue] = useState(quickSearch || '');
  
  // State for search expansion
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  // State for dynamic width
  const [searchWidth, setSearchWidth] = useState(280);
  
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
  const searchContainerRef = useRef(null);

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

  // Handle search input key press (search on Enter)
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setQuickSearch(searchInputValue);
    }
  };

  // Handle search clear
  const handleSearchClear = () => {
    setSearchInputValue('');
    setQuickSearch('');
  };

  // Calculate available width for search expansion
  const calculateSearchWidth = () => {
    if (!searchContainerRef.current) return 400;
    
    // Try to find the table toolbar or table controls container
    const tableToolbar = searchContainerRef.current.closest('.table-toolbar');
    const tableControls = searchContainerRef.current.closest('.table-controls');
    const parentContainer = tableToolbar || tableControls;
    
    if (!parentContainer) return 400;
    
    // Get the advanced filter container (immediate parent)
    const filterContainer = searchContainerRef.current.closest('.advanced-filter-container');
    if (!filterContainer) return 400;
    
    // Calculate available space
    const containerRect = parentContainer.getBoundingClientRect();
    
    // Get all sibling elements after the advanced filter container
    const siblings = Array.from(parentContainer.children);
    const filterIndex = siblings.indexOf(filterContainer);
    const siblingsAfter = siblings.slice(filterIndex + 1);
    
    // Calculate width of elements after the filter container
    const siblingsWidth = siblingsAfter.reduce((total, sibling) => {
      return total + sibling.getBoundingClientRect().width + 16; // 16px gap
    }, 0);
    
    // Calculate available width (more generous in toolbar)
    const usedWidth = 60; // Space for magnifying glass + padding
    const availableWidth = containerRect.width - usedWidth - siblingsWidth - 32; // 32px padding
    
    // More generous bounds for toolbar layout
    return Math.max(320, Math.min(availableWidth, 800));
  };

  // Handle search icon click (expand search)
  const handleSearchIconClick = () => {
    setIsSearchExpanded(true);
    // Calculate width after DOM update
    setTimeout(() => {
      const newWidth = calculateSearchWidth();
      setSearchWidth(newWidth);
    }, 10);
  };

  // Handle search collapse (when clicking outside or escape)
  const handleSearchCollapse = () => {
    if (!searchInputValue && !quickSearch) {
      setIsSearchExpanded(false);
    }
  };

  // Sync searchInputValue when quickSearch changes externally
  useEffect(() => {
    setSearchInputValue(quickSearch || '');
  }, [quickSearch]);

  // Handle outside clicks for search collapse
  useEffect(() => {
    const handleClickOutsideSearch = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        handleSearchCollapse();
      }
    };

    if (isSearchExpanded) {
      document.addEventListener('mousedown', handleClickOutsideSearch);
      return () => document.removeEventListener('mousedown', handleClickOutsideSearch);
    }
  }, [isSearchExpanded, searchInputValue, quickSearch]);

  // Auto-expand search if there's an active search
  useEffect(() => {
    if (quickSearch) {
      const newWidth = calculateSearchWidth();
      setSearchWidth(newWidth);
      setIsSearchExpanded(true);
    }
  }, [quickSearch]);

  // Recalculate width on window resize
  useEffect(() => {
    const handleResize = () => {
      if (isSearchExpanded) {
        const newWidth = calculateSearchWidth();
        setSearchWidth(newWidth);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSearchExpanded]);

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
      {/* Advanced Filter Button */}
      <button
        ref={filterButtonRef}
        onClick={handleFilterToggle}
        className={`action-btn action-btn-secondary advanced-filter-button ${activeFilterCount > 0 ? 'has-filters' : ''}`}
        title="Advanced filters"
      >
        <Filter size={16} />
        <span className="filter-text">Filters</span>
        {activeFilterCount > 0 && (
          <span className="filter-count">{activeFilterCount}</span>
        )}
        {showFilterDropdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Collapsible Search */}
      <div 
        ref={searchContainerRef}
        className={`collapsible-search ${isSearchExpanded ? 'expanded' : 'collapsed'} ${searchInputValue !== quickSearch ? 'has-unsaved-search' : ''} ${quickSearch ? 'has-active-search' : ''}`}
        style={isSearchExpanded ? { width: `${searchWidth}px` } : {}}
      >
        {!isSearchExpanded ? (
          // Collapsed state: just the magnifying glass
          <button
            onClick={handleSearchIconClick}
            className="action-btn action-btn-secondary search-toggle-btn"
            title="Search"
          >
            <Search size={28} />
          </button>
        ) : (
          // Expanded state: full search input
          <>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Quick search... (press Enter)"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              onBlur={handleSearchCollapse}
              className="search-field"
              autoFocus
            />
            {searchInputValue && (
              <button
                onClick={handleSearchClear}
                className="action-btn action-btn-secondary search-clear"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </>
        )}
      </div>

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