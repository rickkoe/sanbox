import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X, Search, ChevronDown, ChevronUp } from 'lucide-react';

const AdvancedFilter = ({
  columns,
  colHeaders,
  visibleColumns,
  quickSearch,
  setQuickSearch,
  onFilterChange,
  data = []
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [filterDropdownPosition, setFilterDropdownPosition] = useState({ top: 0, left: 0 });
  const [activeColumn, setActiveColumn] = useState(null);
  const [columnSearch, setColumnSearch] = useState('');
  
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

  // Get unique values for a column
  const getUniqueValues = (columnIndex) => {
    if (!data || !Array.isArray(data) || !columns[columnIndex]) return [];
    
    const column = columns[columnIndex];
    const values = data
      .map(row => row[column.data])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(value => {
        // Handle boolean values specially
        if (typeof value === 'boolean') {
          return value ? 'True' : 'False';
        }
        return String(value).trim();
      })
      .filter(value => value.length > 0);
    
    const uniqueValues = [...new Set(values)];
    
    // Sort with special handling for boolean-like values
    return uniqueValues.sort((a, b) => {
      // Put boolean values in a logical order
      if (a === 'True' && b === 'False') return -1;
      if (a === 'False' && b === 'True') return 1;
      // For other values, use normal sorting
      return a.localeCompare(b);
    });
  };

  // Filter visible columns for dropdown
  const getFilterableColumns = () => {
    // Handle both array and object formats for visibleColumns
    const isVisible = (index) => {
      if (Array.isArray(visibleColumns)) {
        return visibleColumns.includes(index);
      } else if (visibleColumns && typeof visibleColumns === 'object') {
        return visibleColumns[index] === true;
      }
      return true; // Default to visible if format is unclear
    };

    return columns
      .map((col, index) => ({
        index,
        header: colHeaders[index] || `Column ${index + 1}`,
        visible: isVisible(index)
      }))
      .filter(col => col.visible)
      .filter(col => {
        if (!columnSearch) return true;
        return col.header.toLowerCase().includes(columnSearch.toLowerCase());
      });
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
        // Add value
        currentFilter.value = [...currentValues, value];
      } else {
        // Remove value
        currentFilter.value = currentValues.filter(v => v !== value);
      }
      
      // Remove filter if no values selected
      if (currentFilter.value.length === 0) {
        delete newFilters[columnIndex];
      }
    } else {
      // Create new multi-select filter
      newFilters[columnIndex] = { type: 'multi_select', value: [value] };
    }
    
    setActiveFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // Check if value is selected in multi-select filter
  const isValueSelected = (columnIndex, value) => {
    const filter = activeFilters[columnIndex];
    return filter && filter.type === 'multi_select' && filter.value && filter.value.includes(value);
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
          placeholder="Quick search across all columns..."
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
                      onClick={() => setActiveColumn(activeColumn === col.index ? null : col.index)}
                      className={`column-filter-toggle ${hasFilter ? 'has-filter' : ''}`}
                    >
                      <span className="column-name">{col.header}</span>
                      {hasFilter && (
                        <span className="filter-indicator">
                          {activeFilters[col.index].type === 'multi_select' 
                            ? `${activeFilters[col.index].value.length} selected`
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
                        {/* Text Filter */}
                        <div className="filter-section">
                          <label className="filter-label">Text Filter</label>
                          <input
                            type="text"
                            placeholder="Enter filter value..."
                            value={hasFilter && activeFilters[col.index].type === 'contains' ? activeFilters[col.index].value : ''}
                            onChange={(e) => handleColumnFilter(col.index, 'contains', e.target.value)}
                            className="filter-input"
                          />
                        </div>
                        
                        {/* Value Selection */}
                        {uniqueValues.length > 0 && uniqueValues.length <= 50 && (
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
                        )}
                        
                        {uniqueValues.length > 50 && (
                          <div className="filter-section">
                            <div className="too-many-values">
                              Too many unique values ({uniqueValues.length}). Use text filter instead.
                            </div>
                          </div>
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