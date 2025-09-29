/**
 * Server-side filter utilities for TanStack Table
 * Migrated and enhanced from GenericTable/utils/columnFilterUtils.js
 */

/**
 * Generate server-side filter parameters from column filters
 * Converts TanStack Table filter state to Django backend filter format
 */
export function generateServerFilters(columnFilters, columns, colHeaders, dropdownSources, visibleColumns) {
  const serverFilters = {};

  Object.entries(columnFilters).forEach(([columnId, filterValue]) => {
    // Find column configuration
    const column = columns.find(col => col.accessorKey === columnId || col.id === columnId);
    if (!column) return;

    // Handle different filter types
    if (filterValue && typeof filterValue === 'object') {
      if (filterValue.type && filterValue.value !== undefined) {
        const serverParam = generateServerFilterParam(column, filterValue, dropdownSources);
        if (serverParam) {
          Object.assign(serverFilters, serverParam);
        }
      }
    } else if (filterValue !== undefined && filterValue !== '') {
      // Simple string filter - default to contains
      const serverParam = generateServerFilterParam(column, {
        type: 'contains',
        value: filterValue
      }, dropdownSources);
      if (serverParam) {
        Object.assign(serverFilters, serverParam);
      }
    }
  });

  return serverFilters;
}

/**
 * Generate individual server filter parameter
 */
function generateServerFilterParam(column, filterValue, dropdownSources) {
  const fieldName = column.accessorKey || column.id;
  const { type, value } = filterValue;

  if (value === undefined || value === null || value === '') {
    return null;
  }

  switch (type) {
    case 'contains':
      return { [`${fieldName}__icontains`]: value };

    case 'equals':
      return { [fieldName]: value };

    case 'starts_with':
      return { [`${fieldName}__istartswith`]: value };

    case 'ends_with':
      return { [`${fieldName}__iendswith`]: value };

    case 'not_contains':
      return { [`${fieldName}__not_icontains`]: value };

    case 'greater_than':
      return { [`${fieldName}__gt`]: value };

    case 'greater_than_equal':
      return { [`${fieldName}__gte`]: value };

    case 'less_than':
      return { [`${fieldName}__lt`]: value };

    case 'less_than_equal':
      return { [`${fieldName}__lte`]: value };

    case 'multi_select':
      if (Array.isArray(value) && value.length > 0) {
        // Handle boolean values for multi-select
        if (column.meta?.type === 'boolean') {
          const booleanValues = value.map(v => v === 'True' || v === true);
          return { [`${fieldName}__in`]: booleanValues };
        }
        return { [`${fieldName}__in`]: value };
      }
      return null;

    case 'date_equals':
      return { [`${fieldName}__date`]: value };

    case 'date_after':
      return { [`${fieldName}__date__gt`]: value };

    case 'date_before':
      return { [`${fieldName}__date__lt`]: value };

    case 'is_null':
      return { [`${fieldName}__isnull`]: value === true };

    case 'is_not_null':
      return { [`${fieldName}__isnull`]: value === false };

    default:
      // Fallback to contains for unknown filter types
      return { [`${fieldName}__icontains`]: value };
  }
}

/**
 * Create column metadata for filtering
 * Enhanced version that works with TanStack Table column definitions
 */
export function createColumnMetadata(columns, colHeaders, visibleColumns, dropdownSources, columnVisibility) {
  return columns.map((column, index) => {
    const columnId = column.accessorKey || column.id;
    const headerName = column.header || colHeaders[index] || columnId;

    // Determine if column is visible
    const isVisible = columnVisibility[columnId] !== false;

    // Get dropdown source if available
    const dropdownSource = dropdownSources[columnId] || dropdownSources[headerName];

    // Determine column type from meta or infer from data
    const columnType = column.meta?.type || inferColumnType(column, dropdownSource);

    // Determine available filter types
    const filterTypes = getAvailableFilterTypes(columnType, dropdownSource);

    return {
      id: columnId,
      accessorKey: columnId,
      header: headerName,
      index,
      isVisible,
      type: columnType,
      filterTypes,
      dropdownSource: dropdownSource || null,
      meta: column.meta || {},
    };
  });
}

/**
 * Infer column type from column definition or dropdown source
 */
function inferColumnType(column, dropdownSource) {
  // Check column meta first
  if (column.meta?.type) {
    return column.meta.type;
  }

  // Check if it's a dropdown/select column
  if (dropdownSource) {
    return 'select';
  }

  // Try to infer from accessor key name
  const accessorKey = column.accessorKey || column.id || '';

  if (accessorKey.includes('date') || accessorKey.includes('time')) {
    return 'date';
  }

  if (accessorKey.includes('count') || accessorKey.includes('number') || accessorKey.includes('size')) {
    return 'number';
  }

  if (accessorKey.includes('is_') || accessorKey.includes('has_') || accessorKey.includes('enabled')) {
    return 'boolean';
  }

  // Default to text
  return 'text';
}

/**
 * Get available filter types for a column based on its type
 */
function getAvailableFilterTypes(columnType, dropdownSource) {
  const baseTypes = ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'];

  switch (columnType) {
    case 'text':
    case 'string':
      return baseTypes;

    case 'number':
    case 'integer':
      return [
        'equals',
        'greater_than',
        'greater_than_equal',
        'less_than',
        'less_than_equal',
        'is_null',
        'is_not_null'
      ];

    case 'boolean':
      return ['equals', 'multi_select'];

    case 'select':
    case 'dropdown':
      return dropdownSource && Array.isArray(dropdownSource) && dropdownSource.length > 5
        ? ['multi_select', 'equals']
        : ['equals', 'multi_select'];

    case 'date':
    case 'datetime':
      return [
        'date_equals',
        'date_after',
        'date_before',
        'is_null',
        'is_not_null'
      ];

    default:
      return baseTypes;
  }
}

/**
 * Apply client-side filters (for non-server pagination tables)
 * Enhanced version for TanStack Table
 */
export function applyAllFilters(data, columnFilters, columnMetadata) {
  if (!data || data.length === 0) return data;
  if (!columnFilters || Object.keys(columnFilters).length === 0) return data;

  return data.filter(row => {
    return Object.entries(columnFilters).every(([columnId, filterValue]) => {
      const columnMeta = columnMetadata.find(col => col.id === columnId);
      if (!columnMeta) return true;

      return applyColumnFilter(row, columnMeta, filterValue);
    });
  });
}

/**
 * Apply a single column filter to a row
 */
function applyColumnFilter(row, columnMeta, filterValue) {
  const { id: columnId, type: columnType } = columnMeta;

  // Get value from row - handle nested properties
  let value = getNestedValue(row, columnId);

  // Handle null/undefined values
  if (value === null || value === undefined) {
    if (filterValue.type === 'is_null') return filterValue.value === true;
    if (filterValue.type === 'is_not_null') return filterValue.value === false;
    return false;
  }

  const { type, value: filterVal } = filterValue;

  // Convert value to string for most operations
  const stringValue = String(value).toLowerCase();
  const filterString = String(filterVal).toLowerCase();

  switch (type) {
    case 'contains':
      return stringValue.includes(filterString);

    case 'equals':
      if (columnType === 'boolean') {
        const boolValue = value === true || value === 'true' || value === 'True';
        const filterBoolValue = filterVal === true || filterVal === 'true' || filterVal === 'True';
        return boolValue === filterBoolValue;
      }
      return stringValue === filterString;

    case 'starts_with':
      return stringValue.startsWith(filterString);

    case 'ends_with':
      return stringValue.endsWith(filterString);

    case 'not_contains':
      return !stringValue.includes(filterString);

    case 'greater_than':
      return Number(value) > Number(filterVal);

    case 'greater_than_equal':
      return Number(value) >= Number(filterVal);

    case 'less_than':
      return Number(value) < Number(filterVal);

    case 'less_than_equal':
      return Number(value) <= Number(filterVal);

    case 'multi_select':
      if (!Array.isArray(filterVal)) return true;
      if (filterVal.length === 0) return false;

      if (columnType === 'boolean') {
        const boolValue = value === true || value === 'true' || value === 'True';
        const boolString = boolValue ? 'True' : 'False';
        return filterVal.includes(boolString) || filterVal.includes(boolValue);
      }

      return filterVal.map(v => v.toLowerCase()).includes(stringValue);

    case 'date_equals':
      return new Date(value).toDateString() === new Date(filterVal).toDateString();

    case 'date_after':
      return new Date(value) > new Date(filterVal);

    case 'date_before':
      return new Date(value) < new Date(filterVal);

    case 'is_null':
      return (value === null || value === undefined) === (filterVal === true);

    case 'is_not_null':
      return (value !== null && value !== undefined) === (filterVal === true);

    default:
      return true;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  if (!path.includes('.')) {
    return obj[path];
  }

  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

/**
 * Debounce function for filter changes
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}