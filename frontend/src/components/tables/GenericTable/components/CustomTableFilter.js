// CustomTableFilter.js - Add this as a new component
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const CustomTableFilter = ({ 
  columns, 
  colHeaders, 
  data, 
  onFilterChange, 
  visibleColumns = {},
  initialFilters = {},
  apiUrl = null,  // Add apiUrl prop for fetching unique values
  serverPagination = false  // Add serverPagination prop to detect pagination mode
}) => {
  const [filters, setFilters] = useState(() => initialFilters || {});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const buttonRefs = useRef({});
  
  // Cache for unique values fetched from server
  const [uniqueValuesCache, setUniqueValuesCache] = useState({});

  // Debug: Log when CustomTableFilter mounts/updates
  useEffect(() => {
    console.log(`🎨 CustomTableFilter mounted/updated: serverPagination=${serverPagination}, apiUrl=${apiUrl}, columns=${columns?.length}, data=${data?.length}`);
  }, [serverPagination, apiUrl, columns, data]);

  // Update filters when initialFilters prop changes
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveFilterColumn(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      
      console.log(`🔍 Fetching unique values for ${fieldName}:`, uniqueValuesUrl);
      
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
        .sort();
      
      const finalValues = [...new Set(processedValues)];
      
      // Cache the result
      setUniqueValuesCache(prev => ({
        ...prev,
        [cacheKey]: finalValues
      }));
      
      console.log(`✅ Got ${finalValues.length} unique values for ${fieldName}:`, finalValues);
      return finalValues;
      
    } catch (error) {
      console.error(`Failed to fetch unique values for ${column.data}:`, error);
      
      // Fallback to local data
      return getLocalUniqueValues(columnIndex);
    }
  };

  // Get unique values from local data (original implementation)
  const getLocalUniqueValues = (columnIndex) => {
    const column = columns[columnIndex];
    if (!column) return [];

    const values = data
      .map(row => {
        // Handle nested object values (like fabric_details.name)
        let value;
        if (column.data.includes('.')) {
          const keys = column.data.split('.');
          let nestedValue = row;
          for (const key of keys) {
            nestedValue = nestedValue?.[key];
            if (nestedValue === null || nestedValue === undefined) break;
          }
          value = nestedValue;
        } else {
          value = row[column.data];
        }
        return value;
      })
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(value => {
        // Handle boolean values consistently
        if (typeof value === 'boolean') {
          return value ? 'True' : 'False';
        }
        return String(value).trim();
      })
      .filter(value => value !== '');

    return [...new Set(values)].sort();
  };

  // Main function to get unique values - uses server fetch for server pagination, local data otherwise
  const getUniqueValues = (columnIndex) => {
    if (serverPagination && apiUrl) {
      // For server pagination, we'll fetch unique values asynchronously
      // This function returns the cached values if available, empty array otherwise
      const column = columns[columnIndex];
      if (!column) return [];
      
      const cacheKey = `${columnIndex}_${column.data}`;
      return uniqueValuesCache[cacheKey] || [];
    } else {
      // For client-side data, use the local implementation
      return getLocalUniqueValues(columnIndex);
    }
  };

  // Apply filters to data
  const applyFilters = (newFilters) => {
    // Pass the filter object to the parent component
    onFilterChange(newFilters);
  };

  // Update filter for a column
  const updateFilter = (columnIndex, filterData) => {
    const newFilters = { ...filters };
    
    if (filterData) {
      newFilters[columnIndex] = filterData;
    } else {
      delete newFilters[columnIndex];
    }
    
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters({});
    setActiveFilterColumn(null);
    onFilterChange({});
  };

  // Toggle filter dropdown
  const toggleFilterDropdown = (columnIndex, event) => {
    event.stopPropagation();
    
    console.log(`🎯 toggleFilterDropdown called with columnIndex=${columnIndex}, serverPagination=${serverPagination}`);
    
    if (activeFilterColumn === columnIndex) {
      setActiveFilterColumn(null);
      return;
    }

    const buttonRect = event.currentTarget.getBoundingClientRect();
    setFilterDropdownPosition({
      top: buttonRect.bottom + window.scrollY + 4,
      left: buttonRect.left + window.scrollX
    });
    
    setActiveFilterColumn(columnIndex);
    console.log(`📂 Filter dropdown opened for column ${columnIndex}`);
  };

  // Get visible columns only
  const getVisibleColumns = () => {
    return columns
      .map((col, index) => ({ ...col, originalIndex: index }))
      .filter((col, index) => visibleColumns[index] !== false);
  };

  const visibleCols = getVisibleColumns();


  return (
    <div className="custom-table-filter">
      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-buttons">
          {visibleCols.map((column, displayIndex) => {
            const originalIndex = column.originalIndex;
            const filter = filters[originalIndex];
            const hasFilter = !!filter && (
              // Text-based filters (contains, equals, starts_with, ends_with, not_contains)
              (['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(filter.type) && 
               filter.value && typeof filter.value === 'string' && filter.value.trim() !== '') ||
              // Multi-select filters
              (filter.type === 'multi_select' && 
               Array.isArray(filter.value) && filter.value.length > 0)
            );
            const headerText = colHeaders[originalIndex] || column.data;
            
            
            return (
              <button
                key={originalIndex}
                ref={el => buttonRefs.current[originalIndex] = el}
                className={`filter-column-btn ${hasFilter ? 'active' : ''}`}
                onClick={(e) => toggleFilterDropdown(originalIndex, e)}
                title={`Filter ${headerText}`}
              >
                <span>{headerText}</span>
                {hasFilter && <span className="filter-indicator">●</span>}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                </svg>
              </button>
            );
          })}
        </div>
        
        {Object.keys(filters).length > 0 && (
          <button className="clear-filters-btn" onClick={clearAllFilters}>
            Clear All Filters ({Object.keys(filters).length})
          </button>
        )}
      </div>

      {/* Filter Dropdown */}
      {activeFilterColumn !== null && (
        <FilterDropdown
          ref={dropdownRef}
          columnIndex={activeFilterColumn}
          column={columns[activeFilterColumn]}
          headerText={colHeaders[activeFilterColumn] || columns[activeFilterColumn].data}
          uniqueValues={getUniqueValues(activeFilterColumn)}
          currentFilter={filters[activeFilterColumn]}
          position={filterDropdownPosition}
          onFilterUpdate={(filterData) => updateFilter(activeFilterColumn, filterData)}
          onClose={() => setActiveFilterColumn(null)}
          fetchUniqueValues={serverPagination ? fetchUniqueValues : null}
          serverPagination={serverPagination}
        />
      )}
    </div>
  );
};

// Filter Dropdown Component
const FilterDropdown = React.forwardRef(({
  columnIndex,
  column,
  headerText,
  uniqueValues,
  currentFilter,
  position,
  onFilterUpdate,
  onClose,
  fetchUniqueValues,
  serverPagination
}, ref) => {
  // Initialize state based on GenericTable filter format
  const initializeState = (filter) => {
    if (!filter) {
      return {
        filterType: 'text',
        textFilter: { condition: 'contains', value: '' },
        selectedValues: new Set(uniqueValues)
      };
    }
    
    if (['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(filter.type)) {
      return {
        filterType: 'text',
        textFilter: { condition: filter.type, value: filter.value || '' },
        selectedValues: new Set(uniqueValues)
      };
    } else if (filter.type === 'multi_select') {
      return {
        filterType: 'values',
        textFilter: { condition: 'contains', value: '' },
        selectedValues: new Set(Array.isArray(filter.value) ? filter.value : uniqueValues)
      };
    } else {
      return {
        filterType: 'text',
        textFilter: { condition: 'contains', value: filter.value || '' },
        selectedValues: new Set(uniqueValues)
      };
    }
  };

  const initialState = initializeState(currentFilter);
  const [filterType, setFilterType] = useState(initialState.filterType);
  const [textFilter, setTextFilter] = useState(initialState.textFilter);
  const [selectedValues, setSelectedValues] = useState(initialState.selectedValues);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingUniqueValues, setLoadingUniqueValues] = useState(false);
  const [actualUniqueValues, setActualUniqueValues] = useState(uniqueValues);

  // Fetch unique values when dropdown opens (for server pagination)
  useEffect(() => {
    console.log(`🔍 FilterDropdown useEffect: serverPagination=${serverPagination}, fetchUniqueValues=${!!fetchUniqueValues}, columnIndex=${columnIndex}, actualUniqueValues.length=${actualUniqueValues.length}`);
    
    if (serverPagination && fetchUniqueValues && actualUniqueValues.length === 0) {
      console.log(`📡 Fetching unique values for column ${columnIndex}...`);
      setLoadingUniqueValues(true);
      fetchUniqueValues(columnIndex)
        .then(values => {
          console.log(`✅ Received unique values for column ${columnIndex}:`, values);
          setActualUniqueValues(values);
          setLoadingUniqueValues(false);
          
          // Update selectedValues to include all fetched values if no current filter
          if (!currentFilter || (currentFilter.type === 'multi_select' && (!currentFilter.value || currentFilter.value.length === 0))) {
            setSelectedValues(new Set(values));
          }
        })
        .catch(error => {
          console.error(`❌ Failed to fetch unique values for column ${columnIndex}:`, error);
          setLoadingUniqueValues(false);
        });
    } else {
      console.log(`📦 Using existing unique values: actualUniqueValues.length=${actualUniqueValues.length}, uniqueValues.length=${uniqueValues.length}`);
      setActualUniqueValues(uniqueValues);
    }
  }, [serverPagination, fetchUniqueValues, columnIndex, uniqueValues, currentFilter]);

  // Update state when currentFilter changes (when dropdown reopens with different filter)
  useEffect(() => {
    const valuesToUse = actualUniqueValues.length > 0 ? actualUniqueValues : uniqueValues;
    
    if (currentFilter) {
      // Convert GenericTable format to CustomTableFilter format
      if (['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(currentFilter.type)) {
        // Text-based filter
        setFilterType('text');
        setTextFilter({
          condition: currentFilter.type,
          value: currentFilter.value || ''
        });
        setSelectedValues(new Set(valuesToUse));
      } else if (currentFilter.type === 'multi_select') {
        // Multi-select filter
        setFilterType('values');
        setTextFilter({ condition: 'contains', value: '' });
        const selectedVals = Array.isArray(currentFilter.value) ? currentFilter.value : [];
        setSelectedValues(new Set(selectedVals));
      } else {
        // Fallback
        setFilterType('text');
        setTextFilter({ condition: 'contains', value: currentFilter.value || '' });
        setSelectedValues(new Set(valuesToUse));
      }
    } else {
      // Reset to defaults when no current filter
      setFilterType('text');
      setTextFilter({ condition: 'contains', value: '' });
      setSelectedValues(new Set(valuesToUse));
    }
    setSearchTerm(''); // Always reset search term
  }, [currentFilter, actualUniqueValues, uniqueValues]);

  const textConditions = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'not_contains', label: 'Does not contain' }
  ];

  const valuesToUse = actualUniqueValues.length > 0 ? actualUniqueValues : uniqueValues;
  const filteredValues = valuesToUse.filter(value =>
    value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleApplyFilter = () => {
    if (filterType === 'text') {
      if (textFilter.value.trim()) {
        // Convert CustomTableFilter format to GenericTable format
        onFilterUpdate({
          type: textFilter.condition, // contains, equals, starts_with, etc.
          value: textFilter.value.trim()
        });
      } else {
        onFilterUpdate(null);
      }
    } else if (filterType === 'values') {
      if (selectedValues.size === valuesToUse.length || selectedValues.size === 0) {
        onFilterUpdate(null);
      } else {
        // Convert CustomTableFilter format to GenericTable format
        onFilterUpdate({
          type: 'multi_select',
          value: Array.from(selectedValues)
        });
      }
    }
    onClose();
  };

  const handleClearFilter = () => {
    onFilterUpdate(null);
    onClose();
  };

  const toggleSelectAll = () => {
    if (selectedValues.size === filteredValues.length) {
      setSelectedValues(new Set());
    } else {
      setSelectedValues(new Set(filteredValues));
    }
  };

  const toggleValue = (value) => {
    const newSelected = new Set(selectedValues);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelectedValues(newSelected);
  };

  return (
    <div
      ref={ref}
      className="filter-dropdown"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 10000
      }}
    >
      <div className="filter-dropdown-header">
        <h4>Filter: {headerText}</h4>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="filter-type-tabs">
        <button
          className={`filter-tab ${filterType === 'text' ? 'active' : ''}`}
          onClick={() => setFilterType('text')}
        >
          Text Filter
        </button>
        <button
          className={`filter-tab ${filterType === 'values' ? 'active' : ''}`}
          onClick={() => setFilterType('values')}
        >
          Value Filter
        </button>
      </div>

      {filterType === 'text' ? (
        <div className="text-filter-content">
          <select
            value={textFilter.condition}
            onChange={(e) => setTextFilter(prev => ({ ...prev, condition: e.target.value }))}
            className="filter-condition-select"
          >
            {textConditions.map(condition => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Enter filter value..."
            value={textFilter.value}
            onChange={(e) => setTextFilter(prev => ({ ...prev, value: e.target.value }))}
            className="filter-text-input"
          />
        </div>
      ) : (
        <div className="values-filter-content">
          <input
            type="text"
            placeholder="Search values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="filter-search-input"
            disabled={loadingUniqueValues}
          />
          
          {loadingUniqueValues ? (
            <div className="loading-unique-values">
              <div className="spinner"></div>
              <span>Loading filter options...</span>
            </div>
          ) : (
            <>
              <div className="select-all-container">
                <label className="select-all-label">
                  <input
                    type="checkbox"
                    checked={selectedValues.size === filteredValues.length && filteredValues.length > 0}
                    onChange={toggleSelectAll}
                  />
                  Select All ({filteredValues.length})
                </label>
              </div>
              
              <div className="values-list">
                {filteredValues.map(value => (
                  <label key={value} className="value-item">
                    <input
                      type="checkbox"
                      checked={selectedValues.has(value)}
                      onChange={() => toggleValue(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="filter-actions">
        <button className="filter-btn filter-btn-clear" onClick={handleClearFilter}>
          Clear
        </button>
        <button className="filter-btn filter-btn-apply" onClick={handleApplyFilter}>
          Apply
        </button>
      </div>
    </div>
  );
});

export default CustomTableFilter;