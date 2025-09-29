import { useState, useCallback, useMemo } from 'react';
import { debounce } from '../../utils/serverFilterUtils';

/**
 * Advanced filtering hook for TanStack Table
 * Provides column-level filtering with various filter types
 */
export function useAdvancedFiltering({
  table,
  columns = [],
  dropdownSources = {},
  serverSide = false,
  onFilterChange,
}) {
  const [columnFilters, setColumnFilters] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Debounced filter change handler for server-side filtering
  const debouncedFilterChange = useMemo(
    () => debounce((filters) => {
      if (onFilterChange) {
        onFilterChange(filters);
      }
    }, 300),
    [onFilterChange]
  );

  // Update column filter
  const updateColumnFilter = useCallback((columnId, filterValue) => {
    const newFilters = columnFilters.filter(filter => filter.id !== columnId);

    if (filterValue && filterValue !== '') {
      newFilters.push({ id: columnId, value: filterValue });
    }

    setColumnFilters(newFilters);
    table.setColumnFilters(newFilters);

    if (serverSide) {
      debouncedFilterChange(newFilters);
    }
  }, [columnFilters, table, serverSide, debouncedFilterChange]);

  // Update global filter
  const updateGlobalFilter = useCallback((filterValue) => {
    setGlobalFilter(filterValue);
    table.setGlobalFilter(filterValue);

    if (serverSide && onFilterChange) {
      debouncedFilterChange({ global: filterValue, columns: columnFilters });
    }
  }, [table, serverSide, columnFilters, onFilterChange, debouncedFilterChange]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setColumnFilters([]);
    setGlobalFilter('');
    table.setColumnFilters([]);
    table.setGlobalFilter('');

    if (serverSide && onFilterChange) {
      onFilterChange([]);
    }
  }, [table, serverSide, onFilterChange]);

  // Clear specific column filter
  const clearColumnFilter = useCallback((columnId) => {
    updateColumnFilter(columnId, null);
  }, [updateColumnFilter]);

  // Get filter metadata for columns
  const getColumnFilterMetadata = useCallback(() => {
    return columns.map(column => {
      const columnId = column.accessorKey || column.id;
      const dropdownSource = dropdownSources[columnId];
      const columnType = column.meta?.type || inferColumnType(column, dropdownSource);

      return {
        id: columnId,
        header: column.header || columnId,
        type: columnType,
        filterTypes: getAvailableFilterTypes(columnType, dropdownSource),
        dropdownSource,
        currentFilter: columnFilters.find(filter => filter.id === columnId)?.value || null,
      };
    });
  }, [columns, dropdownSources, columnFilters]);

  // Get available filter options for multi-select filters
  const getFilterOptions = useCallback((columnId) => {
    const column = columns.find(col => (col.accessorKey || col.id) === columnId);
    if (!column) return [];

    const dropdownSource = dropdownSources[columnId];
    if (dropdownSource && Array.isArray(dropdownSource)) {
      return dropdownSource.map(option => ({
        value: option,
        label: option,
      }));
    }

    // For boolean columns, provide True/False options
    if (column.meta?.type === 'boolean') {
      return [
        { value: true, label: 'True' },
        { value: false, label: 'False' },
      ];
    }

    // For other columns, could extract unique values from data
    // This is more expensive and should be used carefully
    const rows = table.getRowModel().rows;
    const uniqueValues = new Set();

    rows.forEach(row => {
      const value = row.getValue(columnId);
      if (value !== null && value !== undefined && value !== '') {
        uniqueValues.add(value);
      }
    });

    return Array.from(uniqueValues)
      .slice(0, 50) // Limit to first 50 unique values
      .sort()
      .map(value => ({
        value,
        label: String(value),
      }));
  }, [columns, dropdownSources, table]);

  // Filter statistics
  const filterStats = useMemo(() => {
    const totalColumns = columns.length;
    const filteredColumns = columnFilters.length;
    const hasGlobalFilter = globalFilter !== '';

    return {
      totalColumns,
      filteredColumns,
      hasGlobalFilter,
      hasAnyFilters: filteredColumns > 0 || hasGlobalFilter,
      totalRows: table.getRowModel().rows.length,
      filteredRows: table.getFilteredRowModel().rows.length,
    };
  }, [columns.length, columnFilters.length, globalFilter, table]);

  // Export filter state for persistence
  const exportFilterState = useCallback(() => {
    return {
      columnFilters,
      globalFilter,
      timestamp: Date.now(),
    };
  }, [columnFilters, globalFilter]);

  // Import filter state from persistence
  const importFilterState = useCallback((state) => {
    if (!state) return;

    if (state.columnFilters) {
      setColumnFilters(state.columnFilters);
      table.setColumnFilters(state.columnFilters);
    }

    if (state.globalFilter) {
      setGlobalFilter(state.globalFilter);
      table.setGlobalFilter(state.globalFilter);
    }
  }, [table]);

  return {
    // Filter state
    columnFilters,
    globalFilter,
    filterStats,

    // Filter actions
    updateColumnFilter,
    updateGlobalFilter,
    clearAllFilters,
    clearColumnFilter,

    // Metadata and options
    getColumnFilterMetadata,
    getFilterOptions,

    // Persistence
    exportFilterState,
    importFilterState,

    // Direct table access
    table,
  };
}

// Helper functions

function inferColumnType(column, dropdownSource) {
  if (column.meta?.type) {
    return column.meta.type;
  }

  if (dropdownSource) {
    return 'select';
  }

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

  return 'text';
}

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