import React, { useState, useMemo, useEffect, useRef } from 'react';

/**
 * Advanced Filter Dropdown Component
 * Provides Excel-like filtering with text-based filters and manual item selection
 */
export function AdvancedFilterDropdown({
  table,
  columns = [],
  dropdownSources = {},
  onFilterChange,
  className = '',
  style = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState(null);
  const [filterMode, setFilterMode] = useState('text'); // 'text' or 'manual'
  const [textFilter, setTextFilter] = useState({ type: 'contains', value: '' });
  const [manualSelection, setManualSelection] = useState(new Set());
  const [searchWithinFilter, setSearchWithinFilter] = useState('');
  const dropdownRef = useRef(null);

  // Get current active filters for display
  const currentFilters = table?.getState().columnFilters || [];

  // Get column information for filtering
  const filterableColumns = useMemo(() => {
    return columns.map((col, index) => ({
      id: col.data || col.id || `column_${index}`,
      label: col.title || col.header || col.data || `Column ${index + 1}`,
      type: col.type || 'text',
    }));
  }, [columns]);

  // Get unique values for manual selection
  const getUniqueValues = useMemo(() => {
    if (!selectedColumn || !table) return [];

    const columnId = selectedColumn.id;
    const allRows = table.getPreFilteredRowModel().rows;
    const values = new Set();

    allRows.forEach(row => {
      const value = row.getValue(columnId);
      if (value !== null && value !== undefined && value !== '') {
        values.add(value);
      }
    });

    return Array.from(values).sort();
  }, [selectedColumn, table]);

  // Filter unique values based on search
  const filteredUniqueValues = useMemo(() => {
    if (!searchWithinFilter) return getUniqueValues;

    return getUniqueValues.filter(value =>
      String(value).toLowerCase().includes(searchWithinFilter.toLowerCase())
    );
  }, [getUniqueValues, searchWithinFilter]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset filter state when column changes
  useEffect(() => {
    if (selectedColumn) {
      setTextFilter({ type: 'contains', value: '' });
      setManualSelection(new Set());
      setSearchWithinFilter('');
    }
  }, [selectedColumn]);

  // Get active filter count
  const activeFilterCount = currentFilters.length;

  // Handle applying text filter
  const handleApplyTextFilter = () => {
    if (!selectedColumn || !textFilter.value.trim()) return;

    const newFilter = {
      id: selectedColumn.id,
      value: {
        type: textFilter.type,
        value: textFilter.value.trim()
      }
    };

    const existingFilters = currentFilters.filter(f => f.id !== selectedColumn.id);
    const updatedFilters = [...existingFilters, newFilter];

    table.setColumnFilters(updatedFilters);
    if (onFilterChange) onFilterChange(updatedFilters);

    setIsOpen(false);
  };

  // Handle applying manual selection filter
  const handleApplyManualFilter = () => {
    if (!selectedColumn || manualSelection.size === 0) return;

    const newFilter = {
      id: selectedColumn.id,
      value: {
        type: 'manual_selection',
        value: Array.from(manualSelection)
      }
    };

    const existingFilters = currentFilters.filter(f => f.id !== selectedColumn.id);
    const updatedFilters = [...existingFilters, newFilter];

    table.setColumnFilters(updatedFilters);
    if (onFilterChange) onFilterChange(updatedFilters);

    setIsOpen(false);
  };

  // Handle clearing all filters
  const handleClearFilters = () => {
    table.setColumnFilters([]);
    if (onFilterChange) onFilterChange([]);
    setIsOpen(false);
  };

  // Handle removing specific filter
  const handleRemoveFilter = (filterId) => {
    const updatedFilters = currentFilters.filter(f => f.id !== filterId);
    table.setColumnFilters(updatedFilters);
    if (onFilterChange) onFilterChange(updatedFilters);
  };

  // Handle manual selection toggle
  const handleToggleManualSelection = (value) => {
    const newSelection = new Set(manualSelection);
    if (newSelection.has(value)) {
      newSelection.delete(value);
    } else {
      newSelection.add(value);
    }
    setManualSelection(newSelection);
  };

  // Handle select/deselect all in manual mode
  const handleSelectAll = () => {
    setManualSelection(new Set(filteredUniqueValues));
  };

  const handleDeselectAll = () => {
    setManualSelection(new Set());
  };

  return (
    <div className={`advanced-filter-dropdown ${className}`} style={{ position: 'relative', ...style }} ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 12px',
          border: '1px solid #3498db',
          borderRadius: '4px',
          backgroundColor: activeFilterCount > 0 ? '#3498db' : 'white',
          color: activeFilterCount > 0 ? 'white' : '#3498db',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        🎛️ Advanced Filters {activeFilterCount > 0 && `(${activeFilterCount})`} ▾
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Content */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '350px',
              maxWidth: '500px',
              padding: '16px',
              maxHeight: '500px',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600' }}>
                Advanced Filters
              </h3>
              {activeFilterCount > 0 && (
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                  <button
                    onClick={handleClearFilters}
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      color: '#e74c3c',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Active Filters Display */}
            {activeFilterCount > 0 && (
              <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>Active Filters:</div>
                {currentFilters.map(filter => {
                  const column = filterableColumns.find(col => col.id === filter.id);
                  const columnLabel = column?.label || filter.id;
                  const filterValue = filter.value;

                  let filterDescription = '';
                  if (typeof filterValue === 'object' && filterValue.type) {
                    if (filterValue.type === 'manual_selection') {
                      filterDescription = `Selected: ${filterValue.value.slice(0, 3).join(', ')}${filterValue.value.length > 3 ? '...' : ''}`;
                    } else {
                      filterDescription = `${filterValue.type.replace('_', ' ')}: "${filterValue.value}"`;
                    }
                  } else {
                    filterDescription = `Contains: "${filterValue}"`;
                  }

                  return (
                    <div key={filter.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span style={{ fontSize: '12px' }}>
                        <strong>{columnLabel}</strong> - {filterDescription}
                      </span>
                      <button
                        onClick={() => handleRemoveFilter(filter.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#e74c3c',
                          cursor: 'pointer',
                          fontSize: '14px',
                          padding: '2px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Column Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '600' }}>
                Select Column:
              </label>
              <select
                value={selectedColumn?.id || ''}
                onChange={(e) => {
                  const column = filterableColumns.find(col => col.id === e.target.value);
                  setSelectedColumn(column);
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="">Choose a column...</option>
                {filterableColumns.map(column => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Mode Selection */}
            {selectedColumn && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    onClick={() => setFilterMode('text')}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      backgroundColor: filterMode === 'text' ? '#3498db' : 'white',
                      color: filterMode === 'text' ? 'white' : '#333',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Text Filter
                  </button>
                  <button
                    onClick={() => setFilterMode('manual')}
                    style={{
                      padding: '6px 12px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      backgroundColor: filterMode === 'manual' ? '#3498db' : 'white',
                      color: filterMode === 'manual' ? 'white' : '#333',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Manual Selection
                  </button>
                </div>

                {/* Text Filter Mode */}
                {filterMode === 'text' && (
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Filter Type:</label>
                      <select
                        value={textFilter.type}
                        onChange={(e) => setTextFilter(prev => ({ ...prev, type: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        <option value="contains">Contains</option>
                        <option value="not_contains">Doesn't contain</option>
                        <option value="starts_with">Starts with</option>
                        <option value="ends_with">Ends with</option>
                        <option value="equals">Equals</option>
                        <option value="not_equals">Not equals</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Value:</label>
                      <input
                        type="text"
                        value={textFilter.value}
                        onChange={(e) => setTextFilter(prev => ({ ...prev, value: e.target.value }))}
                        placeholder="Enter filter value..."
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                    <button
                      onClick={handleApplyTextFilter}
                      disabled={!textFilter.value.trim()}
                      style={{
                        padding: '6px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: textFilter.value.trim() ? '#27ae60' : '#95a5a6',
                        color: 'white',
                        cursor: textFilter.value.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '12px',
                      }}
                    >
                      Apply Text Filter
                    </button>
                  </div>
                )}

                {/* Manual Selection Mode */}
                {filterMode === 'manual' && (
                  <div style={{ border: '1px solid #eee', padding: '12px', borderRadius: '4px' }}>
                    {/* Search within values */}
                    <div style={{ marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={searchWithinFilter}
                        onChange={(e) => setSearchWithinFilter(e.target.value)}
                        placeholder="Search values..."
                        style={{
                          width: '100%',
                          padding: '6px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      />
                    </div>

                    {/* Select/Deselect All */}
                    <div style={{ marginBottom: '8px', fontSize: '12px' }}>
                      <button
                        onClick={handleSelectAll}
                        style={{
                          marginRight: '8px',
                          padding: '4px 8px',
                          border: '1px solid #ccc',
                          borderRadius: '3px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Select All ({filteredUniqueValues.length})
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        style={{
                          padding: '4px 8px',
                          border: '1px solid #ccc',
                          borderRadius: '3px',
                          backgroundColor: 'white',
                          cursor: 'pointer',
                          fontSize: '11px',
                        }}
                      >
                        Deselect All
                      </button>
                      <span style={{ marginLeft: '8px', color: '#666' }}>
                        {manualSelection.size} selected
                      </span>
                    </div>

                    {/* Values List */}
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '3px' }}>
                      {filteredUniqueValues.map(value => (
                        <label
                          key={value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f5f5f5',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={manualSelection.has(value)}
                            onChange={() => handleToggleManualSelection(value)}
                            style={{ marginRight: '8px' }}
                          />
                          {String(value)}
                        </label>
                      ))}
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={handleApplyManualFilter}
                        disabled={manualSelection.size === 0}
                        style={{
                          padding: '6px 12px',
                          border: 'none',
                          borderRadius: '4px',
                          backgroundColor: manualSelection.size > 0 ? '#27ae60' : '#95a5a6',
                          color: 'white',
                          cursor: manualSelection.size > 0 ? 'pointer' : 'not-allowed',
                          fontSize: '12px',
                        }}
                      >
                        Apply Selection ({manualSelection.size})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AdvancedFilterDropdown;