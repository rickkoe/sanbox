/**
 * Custom filter functions for TanStack Table
 * Provides advanced filtering capabilities similar to Excel
 */

/**
 * Advanced text filter function
 * Handles contains, starts_with, ends_with, equals, not_contains, not_equals
 */
export const advancedTextFilter = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  // Handle null/undefined values
  if (cellValue == null) {
    return filterValue == null;
  }

  const cellStr = String(cellValue).toLowerCase();

  // If filterValue is a simple string, default to 'contains' behavior
  if (typeof filterValue === 'string') {
    return cellStr.includes(filterValue.toLowerCase());
  }

  // Handle advanced filter object
  if (typeof filterValue === 'object' && filterValue.type && filterValue.value != null) {
    const searchValue = String(filterValue.value).toLowerCase();

    switch (filterValue.type) {
      case 'contains':
        return cellStr.includes(searchValue);

      case 'not_contains':
        return !cellStr.includes(searchValue);

      case 'starts_with':
        return cellStr.startsWith(searchValue);

      case 'ends_with':
        return cellStr.endsWith(searchValue);

      case 'equals':
        return cellStr === searchValue;

      case 'not_equals':
        return cellStr !== searchValue;

      default:
        return cellStr.includes(searchValue);
    }
  }

  return true;
};

/**
 * Multi-select filter function
 * Handles array of selected values
 */
export const multiSelectFilter = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  // If no filter value or empty array, show all
  if (!filterValue || !Array.isArray(filterValue) || filterValue.length === 0) {
    return true;
  }

  // Check if cell value is in the selected values
  return filterValue.includes(cellValue);
};

/**
 * Number range filter function
 * Handles greater_than, less_than, equals, etc.
 */
export const numberRangeFilter = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  // Handle null/undefined values
  if (cellValue == null) {
    if (typeof filterValue === 'object' && filterValue.type === 'is_null') {
      return true;
    }
    if (typeof filterValue === 'object' && filterValue.type === 'is_not_null') {
      return false;
    }
    return filterValue == null;
  }

  const cellNum = Number(cellValue);

  // If not a valid number, handle as text
  if (isNaN(cellNum)) {
    return advancedTextFilter(row, columnId, filterValue);
  }

  // Simple number equality
  if (typeof filterValue === 'number') {
    return cellNum === filterValue;
  }

  // Advanced number filter object
  if (typeof filterValue === 'object' && filterValue.type && filterValue.value != null) {
    const compareValue = Number(filterValue.value);

    if (isNaN(compareValue)) {
      return false;
    }

    switch (filterValue.type) {
      case 'equals':
        return cellNum === compareValue;

      case 'greater_than':
        return cellNum > compareValue;

      case 'greater_than_equal':
        return cellNum >= compareValue;

      case 'less_than':
        return cellNum < compareValue;

      case 'less_than_equal':
        return cellNum <= compareValue;

      case 'is_null':
        return false; // We already handled null case above

      case 'is_not_null':
        return true; // We already handled null case above

      default:
        return cellNum === compareValue;
    }
  }

  return true;
};

/**
 * Date filter function
 * Handles date comparisons
 */
export const dateFilter = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  // Handle null/undefined values
  if (cellValue == null) {
    if (typeof filterValue === 'object' && filterValue.type === 'is_null') {
      return true;
    }
    if (typeof filterValue === 'object' && filterValue.type === 'is_not_null') {
      return false;
    }
    return filterValue == null;
  }

  let cellDate;
  try {
    cellDate = new Date(cellValue);
    if (isNaN(cellDate.getTime())) {
      throw new Error('Invalid date');
    }
  } catch {
    // If not a valid date, fall back to text filter
    return advancedTextFilter(row, columnId, filterValue);
  }

  // Simple date equality (string comparison)
  if (typeof filterValue === 'string') {
    try {
      const compareDate = new Date(filterValue);
      return cellDate.toDateString() === compareDate.toDateString();
    } catch {
      return false;
    }
  }

  // Advanced date filter object
  if (typeof filterValue === 'object' && filterValue.type && filterValue.value != null) {
    let compareDate;
    try {
      compareDate = new Date(filterValue.value);
      if (isNaN(compareDate.getTime())) {
        return false;
      }
    } catch {
      return false;
    }

    switch (filterValue.type) {
      case 'date_equals':
        return cellDate.toDateString() === compareDate.toDateString();

      case 'date_after':
        return cellDate > compareDate;

      case 'date_before':
        return cellDate < compareDate;

      case 'is_null':
        return false; // We already handled null case above

      case 'is_not_null':
        return true; // We already handled null case above

      default:
        return cellDate.toDateString() === compareDate.toDateString();
    }
  }

  return true;
};

/**
 * Boolean filter function
 */
export const booleanFilter = (row, columnId, filterValue) => {
  const cellValue = row.getValue(columnId);

  // Handle array of selected values (multi-select)
  if (Array.isArray(filterValue)) {
    return filterValue.includes(cellValue);
  }

  // Simple boolean comparison
  if (typeof filterValue === 'boolean') {
    return cellValue === filterValue;
  }

  // String representations of boolean
  if (typeof filterValue === 'string') {
    const lowerValue = filterValue.toLowerCase();
    if (lowerValue === 'true') {
      return cellValue === true;
    }
    if (lowerValue === 'false') {
      return cellValue === false;
    }
  }

  return true;
};

/**
 * Get the appropriate filter function name for a column type
 */
export const getFilterFunctionName = (columnType, dropdownSource) => {
  switch (columnType) {
    case 'text':
    case 'string':
      return 'advancedTextFilter';

    case 'number':
    case 'integer':
      return 'numberRangeFilter';

    case 'date':
    case 'datetime':
      return 'dateFilter';

    case 'boolean':
      return 'booleanFilter';

    case 'select':
    case 'dropdown':
      // Use multi-select for dropdowns with many options, text filter for few
      if (dropdownSource && Array.isArray(dropdownSource) && dropdownSource.length > 5) {
        return 'multiSelectFilter';
      }
      return 'advancedTextFilter';

    default:
      return 'advancedTextFilter';
  }
};

/**
 * Get the appropriate filter function for a column type
 */
export const getFilterFunction = (columnType, dropdownSource) => {
  switch (columnType) {
    case 'text':
    case 'string':
      return advancedTextFilter;

    case 'number':
    case 'integer':
      return numberRangeFilter;

    case 'date':
    case 'datetime':
      return dateFilter;

    case 'boolean':
      return booleanFilter;

    case 'select':
    case 'dropdown':
      // Use multi-select for dropdowns with many options, text filter for few
      if (dropdownSource && Array.isArray(dropdownSource) && dropdownSource.length > 5) {
        return multiSelectFilter;
      }
      return advancedTextFilter;

    default:
      return advancedTextFilter;
  }
};

/**
 * Enhanced global filter function
 * Searches across all visible columns with smart type detection
 */
export const enhancedGlobalFilter = (row, columnIds, filterValue) => {
  if (!filterValue || filterValue.trim() === '') {
    return true;
  }

  const searchTerm = filterValue.toLowerCase().trim();

  // Search through all specified columns
  return columnIds.some(columnId => {
    const cellValue = row.getValue(columnId);

    if (cellValue == null) {
      return false;
    }

    const cellStr = String(cellValue).toLowerCase();
    return cellStr.includes(searchTerm);
  });
};

/**
 * Utility function to infer column type from data
 */
export const inferColumnType = (values) => {
  if (!values || values.length === 0) {
    return 'text';
  }

  // Take a sample of non-null values
  const nonNullValues = values.filter(v => v != null).slice(0, 20);

  if (nonNullValues.length === 0) {
    return 'text';
  }

  // Check for boolean
  const booleanCount = nonNullValues.filter(v => typeof v === 'boolean').length;
  if (booleanCount > nonNullValues.length * 0.8) {
    return 'boolean';
  }

  // Check for numbers
  const numberCount = nonNullValues.filter(v => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  }).length;
  if (numberCount > nonNullValues.length * 0.8) {
    return 'number';
  }

  // Check for dates
  const dateCount = nonNullValues.filter(v => {
    try {
      const date = new Date(v);
      return !isNaN(date.getTime()) && String(v).match(/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/);
    } catch {
      return false;
    }
  }).length;
  if (dateCount > nonNullValues.length * 0.8) {
    return 'date';
  }

  return 'text';
};

/**
 * Create filter meta for columns with auto-detection
 */
export const createFilterMeta = (columns, data, dropdownSources = {}) => {
  return columns.map(column => {
    const columnId = column.accessorKey || column.id;
    const dropdownSource = dropdownSources[columnId];

    // Use explicit type if provided
    let columnType = column.meta?.type;

    // Auto-detect type if not provided
    if (!columnType && data && data.length > 0) {
      const columnValues = data.map(row => row[columnId]);
      columnType = inferColumnType(columnValues);
    }

    // Default to text if still no type
    columnType = columnType || 'text';

    // Get the filter function name for TanStack Table
    const filterFnName = getFilterFunctionName(columnType, dropdownSource);

    return {
      ...column,
      filterFn: filterFnName, // TanStack Table uses string references to filterFns
      meta: {
        ...column.meta,
        type: columnType,
        dropdownSource,
      }
    };
  });
};

export default {
  advancedTextFilter,
  multiSelectFilter,
  numberRangeFilter,
  dateFilter,
  booleanFilter,
  getFilterFunction,
  getFilterFunctionName,
  enhancedGlobalFilter,
  inferColumnType,
  createFilterMeta,
};