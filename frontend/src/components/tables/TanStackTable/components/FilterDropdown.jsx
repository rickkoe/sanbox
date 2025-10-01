import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Comprehensive Excel-like Filter Dropdown Component
 * Features:
 * - Text filter operations (contains, doesn't contain, starts with, ends with, equals, not equals)
 * - Manual item selection with checkboxes (like Excel)
 * - Search functionality within the filter
 * - Select All / Deselect All options
 * - Clear filters option
 * - Supports multiple columns with individual filter states
 */
const FilterDropdown = ({
  columns = [],
  data = [],
  onFiltersChange,
  activeFilters = {},
  isOpen,
  onToggle,
  className = ''
}) => {
  const [selectedColumn, setSelectedColumn] = useState('');
  const [filterType, setFilterType] = useState('contains');
  const [filterText, setFilterText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showItems, setShowItems] = useState(false);

  const dropdownRef = useRef(null);

  // Filter type options
  const filterTypes = [
    { value: 'contains', label: 'Contains', icon: '⊃' },
    { value: 'not_contains', label: 'Does not contain', icon: '⊅' },
    { value: 'starts_with', label: 'Starts with', icon: '↳' },
    { value: 'ends_with', label: 'Ends with', icon: '↲' },
    { value: 'equals', label: 'Equals', icon: '=' },
    { value: 'not_equals', label: 'Not equals', icon: '≠' },
    { value: 'is_empty', label: 'Is empty', icon: '∅' },
    { value: 'is_not_empty', label: 'Is not empty', icon: '∄' }
  ];

  // Get unique values for selected column
  const columnValues = useMemo(() => {
    if (!selectedColumn || !data.length) return [];

    const values = data
      .map(row => {
        const value = row[selectedColumn];
        return value === null || value === undefined ? '' : String(value);
      })
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort();

    return values;
  }, [selectedColumn, data]);

  // Filtered values based on search
  const filteredValues = useMemo(() => {
    if (!searchText) return columnValues;
    return columnValues.filter(value =>
      value.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [columnValues, searchText]);

  // Initialize selected items when column changes
  useEffect(() => {
    if (selectedColumn && activeFilters[selectedColumn]?.selectedItems) {
      setSelectedItems(new Set(activeFilters[selectedColumn].selectedItems));
    } else {
      setSelectedItems(new Set(columnValues));
    }
  }, [selectedColumn, activeFilters, columnValues]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onToggle(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onToggle]);

  const handleColumnChange = (columnId) => {
    setSelectedColumn(columnId);
    setFilterType('contains');
    setFilterText('');
    setSearchText('');
    setShowItems(false);

    // Load existing filter for this column
    if (activeFilters[columnId]) {
      setFilterType(activeFilters[columnId].type || 'contains');
      setFilterText(activeFilters[columnId].value || '');
    }
  };

  const handleSelectAll = () => {
    setSelectedItems(new Set(filteredValues));
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  const handleItemToggle = (value) => {
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(value)) {
      newSelectedItems.delete(value);
    } else {
      newSelectedItems.add(value);
    }
    setSelectedItems(newSelectedItems);
  };

  const applyTextFilter = () => {
    if (!selectedColumn || !filterText.trim()) return;

    const newFilters = { ...activeFilters };
    newFilters[selectedColumn] = {
      type: filterType,
      value: filterText.trim(),
      active: true
    };

    onFiltersChange(newFilters);
    onToggle(false);
  };

  const applyItemFilter = () => {
    if (!selectedColumn) return;

    const newFilters = { ...activeFilters };
    newFilters[selectedColumn] = {
      type: 'items',
      selectedItems: Array.from(selectedItems),
      active: selectedItems.size > 0 && selectedItems.size < columnValues.length
    };

    onFiltersChange(newFilters);
    onToggle(false);
  };

  const clearColumnFilter = () => {
    if (!selectedColumn) return;

    const newFilters = { ...activeFilters };
    delete newFilters[selectedColumn];

    onFiltersChange(newFilters);
    setFilterText('');
    setSelectedItems(new Set(columnValues));
  };

  const clearAllFilters = () => {
    onFiltersChange({});
    setFilterText('');
    setSelectedItems(new Set(columnValues));
  };

  const getActiveFilterCount = () => {
    return Object.keys(activeFilters).filter(key => activeFilters[key].active).length;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`filter-dropdown ${className}`}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 1000,
        backgroundColor: 'white',
        border: '1px solid #d0d0d0',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '16px',
        minWidth: '350px',
        maxWidth: '450px',
        maxHeight: '500px',
        overflow: 'auto'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#333' }}>
          🔽 Advanced Filters
        </h3>
        {getActiveFilterCount() > 0 && (
          <span style={{
            backgroundColor: '#1976d2',
            color: 'white',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '12px',
            fontWeight: '500'
          }}>
            {getActiveFilterCount()} active
          </span>
        )}
      </div>

      {/* Column Selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#555'
        }}>
          Select Column:
        </label>
        <select
          value={selectedColumn}
          onChange={(e) => handleColumnChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d0d0d0',
            borderRadius: '4px',
            fontSize: '14px',
            outline: 'none',
            backgroundColor: 'white'
          }}
        >
          <option value="">Choose a column...</option>
          {columns.map(column => (
            <option key={column.id} value={column.id}>
              {column.header || column.id}
              {activeFilters[column.id]?.active && ' 🔍'}
            </option>
          ))}
        </select>
      </div>

      {selectedColumn && (
        <>
          {/* Filter Type Tabs */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px'
            }}>
              <button
                onClick={() => setShowItems(false)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  backgroundColor: !showItems ? '#1976d2' : 'white',
                  color: !showItems ? 'white' : '#666',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📝 Text Filter
              </button>
              <button
                onClick={() => setShowItems(true)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #d0d0d0',
                  borderRadius: '4px',
                  backgroundColor: showItems ? '#1976d2' : 'white',
                  color: showItems ? 'white' : '#666',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ☑️ Select Items ({columnValues.length})
              </button>
            </div>

            {!showItems ? (
              /* Text Filter Interface */
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#555'
                  }}>
                    Filter Type:
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '4px',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  >
                    {filterTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {!['is_empty', 'is_not_empty'].includes(filterType) && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      color: '#555'
                    }}>
                      Filter Value:
                    </label>
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Enter filter value..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d0d0d0',
                        borderRadius: '4px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          applyTextFilter();
                        }
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={applyTextFilter}
                  disabled={!filterText.trim() && !['is_empty', 'is_not_empty'].includes(filterType)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    opacity: (!filterText.trim() && !['is_empty', 'is_not_empty'].includes(filterType)) ? 0.5 : 1
                  }}
                >
                  Apply Text Filter
                </button>
              </div>
            ) : (
              /* Items Selection Interface */
              <div>
                {/* Search within items */}
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="🔍 Search items..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d0d0d0',
                      borderRadius: '4px',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Select All / Deselect All */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <button
                    onClick={handleSelectAll}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✗ Deselect All
                  </button>
                </div>

                {/* Items List */}
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  marginBottom: '12px'
                }}>
                  {filteredValues.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#999',
                      fontSize: '13px'
                    }}>
                      No items found
                    </div>
                  ) : (
                    filteredValues.map((value, index) => (
                      <label
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: index < filteredValues.length - 1 ? '1px solid #f5f5f5' : 'none',
                          backgroundColor: selectedItems.has(value) ? '#f0f8ff' : 'transparent',
                          fontSize: '13px'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = selectedItems.has(value) ? '#e6f3ff' : '#f9f9f9';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = selectedItems.has(value) ? '#f0f8ff' : 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.has(value)}
                          onChange={() => handleItemToggle(value)}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {value || '(empty)'}
                        </span>
                      </label>
                    ))
                  )}
                </div>

                <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                  {selectedItems.size} of {columnValues.length} items selected
                </div>

                <button
                  onClick={applyItemFilter}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Apply Selection Filter
                </button>
              </div>
            )}
          </div>

          {/* Column Actions */}
          <div style={{
            display: 'flex',
            gap: '8px',
            paddingTop: '12px',
            borderTop: '1px solid #e0e0e0'
          }}>
            <button
              onClick={clearColumnFilter}
              disabled={!activeFilters[selectedColumn]?.active}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: activeFilters[selectedColumn]?.active ? '#ff9800' : '#e0e0e0',
                color: activeFilters[selectedColumn]?.active ? 'white' : '#999',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: activeFilters[selectedColumn]?.active ? 'pointer' : 'not-allowed'
              }}
            >
              🧹 Clear Column
            </button>
          </div>
        </>
      )}

      {/* Global Actions */}
      <div style={{
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid #e0e0e0'
      }}>
        <button
          onClick={clearAllFilters}
          disabled={getActiveFilterCount() === 0}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: getActiveFilterCount() > 0 ? '#d32f2f' : '#e0e0e0',
            color: getActiveFilterCount() > 0 ? 'white' : '#999',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: getActiveFilterCount() > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          🗑️ Clear All Filters ({getActiveFilterCount()})
        </button>
      </div>
    </div>
  );
};

export default FilterDropdown;