/**
 * Filter utility functions for TanStack Table
 * Provides comprehensive filtering capabilities for text and item-based filters
 */

/**
 * Apply text-based filter to a value
 * @param {string} value - The value to test
 * @param {string} filterValue - The filter value to test against
 * @param {string} filterType - The type of filter to apply
 * @returns {boolean} - Whether the value passes the filter
 */
export const applyTextFilter = (value, filterValue, filterType) => {
  // Handle null/undefined values
  const stringValue = value === null || value === undefined ? '' : String(value).toLowerCase();
  const filterString = String(filterValue).toLowerCase();

  switch (filterType) {
    case 'contains':
      return stringValue.includes(filterString);

    case 'not_contains':
      return !stringValue.includes(filterString);

    case 'starts_with':
      return stringValue.startsWith(filterString);

    case 'ends_with':
      return stringValue.endsWith(filterString);

    case 'equals':
      return stringValue === filterString;

    case 'not_equals':
      return stringValue !== filterString;

    case 'is_empty':
      return stringValue === '';

    case 'is_not_empty':
      return stringValue !== '';

    default:
      return true;
  }
};

/**
 * Apply item-based filter to a value
 * @param {string} value - The value to test
 * @param {Array} selectedItems - Array of selected items
 * @returns {boolean} - Whether the value is in the selected items
 */
export const applyItemFilter = (value, selectedItems) => {
  const stringValue = value === null || value === undefined ? '' : String(value);
  return selectedItems.includes(stringValue);
};

/**
 * Create a TanStack Table compatible filter function
 * @param {Object} activeFilters - Object containing active filter configurations
 * @returns {Function} - Filter function for TanStack Table
 */
export const createTableFilterFunction = (activeFilters) => {
  return (row, columnId, filterValue) => {
    // If no active filters for this column, show all rows
    if (!activeFilters[columnId] || !activeFilters[columnId].active) {
      return true;
    }

    const filter = activeFilters[columnId];
    const cellValue = row.getValue(columnId);

    if (filter.type === 'items') {
      return applyItemFilter(cellValue, filter.selectedItems);
    } else {
      return applyTextFilter(cellValue, filter.value, filter.type);
    }
  };
};

/**
 * Apply all active filters to data array (for client-side filtering)
 * @param {Array} data - Array of data objects
 * @param {Object} activeFilters - Object containing active filter configurations
 * @param {Array} columns - Array of column definitions
 * @returns {Array} - Filtered data array
 */
export const applyFiltersToData = (data, activeFilters, columns) => {
  if (!data || data.length === 0) return data;

  // Get column ids that have active filters
  const activeFilterColumns = Object.keys(activeFilters).filter(
    columnId => activeFilters[columnId].active
  );

  if (activeFilterColumns.length === 0) return data;

  return data.filter(row => {
    return activeFilterColumns.every(columnId => {
      const filter = activeFilters[columnId];
      const cellValue = row[columnId];

      if (filter.type === 'items') {
        return applyItemFilter(cellValue, filter.selectedItems);
      } else {
        return applyTextFilter(cellValue, filter.value, filter.type);
      }
    });
  });
};

/**
 * Get a summary of active filters for display
 * @param {Object} activeFilters - Object containing active filter configurations
 * @param {Array} columns - Array of column definitions
 * @returns {Array} - Array of filter summaries
 */
export const getFilterSummary = (activeFilters, columns) => {
  const columnMap = columns.reduce((acc, col) => {
    acc[col.id] = col.header || col.id;
    return acc;
  }, {});

  return Object.keys(activeFilters)
    .filter(columnId => activeFilters[columnId].active)
    .map(columnId => {
      const filter = activeFilters[columnId];
      const columnName = columnMap[columnId] || columnId;

      if (filter.type === 'items') {
        const itemCount = filter.selectedItems.length;
        return {
          columnId,
          columnName,
          type: 'items',
          summary: `${itemCount} items selected`
        };
      } else {
        return {
          columnId,
          columnName,
          type: 'text',
          summary: `${filter.type}: "${filter.value}"`
        };
      }
    });
};

/**
 * Convert activeFilters to TanStack Table columnFilters format
 * @param {Object} activeFilters - Object containing active filter configurations
 * @returns {Array} - Array of column filters for TanStack Table
 */
export const convertToColumnFilters = (activeFilters) => {
  return Object.keys(activeFilters)
    .filter(columnId => activeFilters[columnId].active)
    .map(columnId => ({
      id: columnId,
      value: activeFilters[columnId]
    }));
};

/**
 * Convert TanStack Table columnFilters to activeFilters format
 * @param {Array} columnFilters - Array of column filters from TanStack Table
 * @returns {Object} - Object containing active filter configurations
 */
export const convertFromColumnFilters = (columnFilters) => {
  const activeFilters = {};

  columnFilters.forEach(filter => {
    if (filter.value && typeof filter.value === 'object') {
      activeFilters[filter.id] = {
        ...filter.value,
        active: true
      };
    }
  });

  return activeFilters;
};

/**
 * Validate filter configuration
 * @param {Object} filter - Filter configuration object
 * @returns {boolean} - Whether the filter configuration is valid
 */
export const validateFilter = (filter) => {
  if (!filter || typeof filter !== 'object') return false;

  if (filter.type === 'items') {
    return Array.isArray(filter.selectedItems);
  } else {
    const textFilterTypes = [
      'contains', 'not_contains', 'starts_with', 'ends_with',
      'equals', 'not_equals', 'is_empty', 'is_not_empty'
    ];

    if (!textFilterTypes.includes(filter.type)) return false;

    // Empty and not_empty filters don't need a value
    if (['is_empty', 'is_not_empty'].includes(filter.type)) {
      return true;
    }

    // Other filters need a value
    return typeof filter.value === 'string' && filter.value.trim().length > 0;
  }
};

/**
 * Clear invalid filters from activeFilters object
 * @param {Object} activeFilters - Object containing active filter configurations
 * @returns {Object} - Cleaned activeFilters object
 */
export const cleanInvalidFilters = (activeFilters) => {
  const cleanedFilters = {};

  Object.keys(activeFilters).forEach(columnId => {
    const filter = activeFilters[columnId];
    if (validateFilter(filter)) {
      cleanedFilters[columnId] = filter;
    }
  });

  return cleanedFilters;
};