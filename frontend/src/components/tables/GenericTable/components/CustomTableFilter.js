// CustomTableFilter.js - Add this as a new component
import React, { useState, useRef, useEffect } from 'react';

const CustomTableFilter = ({ 
  columns, 
  colHeaders, 
  data, 
  onFilterChange, 
  visibleColumns = {},
  initialFilters = {}
}) => {
  const [filters, setFilters] = useState(() => initialFilters || {});
  const [activeFilterColumn, setActiveFilterColumn] = useState(null);
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const buttonRefs = useRef({});

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

  // Get unique values for a column
  const getUniqueValues = (columnIndex) => {
    const column = columns[columnIndex];
    if (!column) return [];

    const values = data
      .map(row => row[column.data])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(value => String(value).trim())
      .filter(value => value !== '');

    return [...new Set(values)].sort();
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
  onClose
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

  // Update state when currentFilter changes (when dropdown reopens with different filter)
  useEffect(() => {
    if (currentFilter) {
      // Convert GenericTable format to CustomTableFilter format
      if (['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'].includes(currentFilter.type)) {
        // Text-based filter
        setFilterType('text');
        setTextFilter({
          condition: currentFilter.type,
          value: currentFilter.value || ''
        });
        setSelectedValues(new Set(uniqueValues));
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
        setSelectedValues(new Set(uniqueValues));
      }
    } else {
      // Reset to defaults when no current filter
      setFilterType('text');
      setTextFilter({ condition: 'contains', value: '' });
      setSelectedValues(new Set(uniqueValues));
    }
    setSearchTerm(''); // Always reset search term
  }, [currentFilter, uniqueValues]);

  const textConditions = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' },
    { value: 'not_contains', label: 'Does not contain' }
  ];

  const filteredValues = uniqueValues.filter(value =>
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
      if (selectedValues.size === uniqueValues.length || selectedValues.size === 0) {
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
          />
          
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