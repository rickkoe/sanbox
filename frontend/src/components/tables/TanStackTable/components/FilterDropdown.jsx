import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '../../../../context/ThemeContext';

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
  const { theme } = useTheme();
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

  // Helper function to get nested property value
  const getNestedValue = (obj, path) => {
    if (!path) return undefined;
    const keys = path.split('.');
    return keys.reduce((current, key) => current?.[key], obj);
  };

  // Get unique values for selected column
  const columnValues = useMemo(() => {
    if (!selectedColumn || !data.length) return [];

    const values = data
      .map(row => {
        // Handle nested properties like "storage_details.name"
        const value = getNestedValue(row, selectedColumn);
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
        backgroundColor: 'var(--table-bg)',
        border: '1px solid var(--table-border)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-medium)',
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
        borderBottom: '1px solid var(--table-border)'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Advanced Filters
        </h3>
        {getActiveFilterCount() > 0 && (
          <span style={{
            backgroundColor: 'var(--link-text)',
            color: 'var(--content-bg)',
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
          color: 'var(--secondary-text)'
        }}>
          Select Column:
        </label>
        <select
          value={selectedColumn}
          onChange={(e) => handleColumnChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid var(--form-input-border)',
            borderRadius: '4px',
            fontSize: '14px',
            outline: 'none',
            backgroundColor: 'var(--form-input-bg)',
            color: 'var(--form-input-text)'
          }}
        >
          <option value="">Choose a column...</option>
          {columns.map(column => {
            // Ensure we only render strings in options (not React elements)
            const headerText = typeof column.header === 'string' ? column.header : column.id;
            return (
              <option key={column.id} value={column.id}>
                {headerText}{activeFilters[column.id]?.active ? ' ●' : ''}
              </option>
            );
          })}
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
                  border: '1px solid var(--table-border)',
                  borderRadius: '4px',
                  backgroundColor: !showItems ? 'var(--link-text)' : 'var(--table-bg)',
                  color: !showItems ? 'var(--content-bg)' : 'var(--secondary-text)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Text Filter
              </button>
              <button
                onClick={() => setShowItems(true)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid var(--table-border)',
                  borderRadius: '4px',
                  backgroundColor: showItems ? 'var(--link-text)' : 'var(--table-bg)',
                  color: showItems ? 'var(--content-bg)' : 'var(--secondary-text)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                Select Items ({columnValues.length})
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
                    color: 'var(--secondary-text)'
                  }}>
                    Filter Type:
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid var(--form-input-border)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: 'var(--form-input-bg)',
                      color: 'var(--form-input-text)'
                    }}
                  >
                    {filterTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {`${type.icon} ${type.label}`}
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
                      color: 'var(--secondary-text)'
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
                        border: '1px solid var(--form-input-border)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        outline: 'none',
                        backgroundColor: 'var(--form-input-bg)',
                        color: 'var(--form-input-text)'
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
                    backgroundColor: 'var(--link-text)',
                    color: 'var(--content-bg)',
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
                    placeholder="Search items..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--form-input-border)',
                      borderRadius: '4px',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: 'var(--form-input-bg)',
                      color: 'var(--form-input-text)'
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
                      backgroundColor: 'var(--link-text)',
                      color: 'var(--content-bg)',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      backgroundColor: 'var(--table-pagination-button-bg)',
                      color: 'var(--table-toolbar-text)',
                      border: '1px solid var(--table-pagination-button-border)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    Deselect All
                  </button>
                </div>

                {/* Items List */}
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid var(--table-border)',
                  borderRadius: '4px',
                  marginBottom: '12px'
                }}>
                  {filteredValues.length === 0 ? (
                    <div style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: 'var(--muted-text)',
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
                          borderBottom: index < filteredValues.length - 1 ? '1px solid var(--table-border)' : 'none',
                          backgroundColor: selectedItems.has(value) ? 'var(--table-row-selected)' : 'transparent',
                          fontSize: '13px',
                          color: 'var(--primary-text)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = selectedItems.has(value) ? 'var(--table-row-selected)' : 'var(--table-row-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = selectedItems.has(value) ? 'var(--table-row-selected)' : 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedItems.has(value)}
                          onChange={() => handleItemToggle(value)}
                          style={{
                            marginRight: '8px',
                            width: '16px',
                            height: '16px',
                            cursor: 'pointer',
                            accentColor: 'var(--link-text)'
                          }}
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

                <div style={{ fontSize: '12px', color: 'var(--secondary-text)', marginBottom: '12px' }}>
                  {selectedItems.size} of {columnValues.length} items selected
                </div>

                <button
                  onClick={applyItemFilter}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--link-text)',
                    color: 'var(--content-bg)',
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
            borderTop: '1px solid var(--table-border)'
          }}>
            <button
              onClick={clearColumnFilter}
              disabled={!activeFilters[selectedColumn]?.active}
              style={{
                flex: 1,
                padding: '8px 12px',
                backgroundColor: activeFilters[selectedColumn]?.active ? 'var(--warning-color)' : 'var(--table-border)',
                color: activeFilters[selectedColumn]?.active ? 'var(--content-bg)' : 'var(--muted-text)',
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: activeFilters[selectedColumn]?.active ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear Column
            </button>
          </div>
        </>
      )}

      {/* Global Actions */}
      <div style={{
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid var(--table-border)'
      }}>
        <button
          onClick={clearAllFilters}
          disabled={getActiveFilterCount() === 0}
          style={{
            width: '100%',
            padding: '10px 12px',
            backgroundColor: getActiveFilterCount() > 0 ? 'var(--error-color)' : 'var(--table-border)',
            color: getActiveFilterCount() > 0 ? 'var(--content-bg)' : 'var(--muted-text)',
            border: 'none',
            borderRadius: '4px',
            fontSize: '13px',
            fontWeight: '500',
            cursor: getActiveFilterCount() > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Clear All Filters ({getActiveFilterCount()})
        </button>
      </div>
    </div>
  );
};

export default FilterDropdown;