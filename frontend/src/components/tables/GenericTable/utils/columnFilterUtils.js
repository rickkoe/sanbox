/**
 * Column Filter Utilities
 * 
 * Robust column detection and filter mapping utilities that work with all table types
 * and column configurations, including dynamic columns, nested values, and all data types.
 */

/**
 * Detect the type of a column based on its configuration and sample data
 * @param {Object} column - Column configuration object
 * @param {string} header - Column header/title
 * @param {Array} sampleData - Sample data to analyze for type detection
 * @param {Object} dropdownSources - Dropdown source configurations
 * @returns {Object} Column type information
 */
export const detectColumnType = (column, header, sampleData = [], dropdownSources = {}) => {
  const columnData = column.data;
  const columnType = column.type;
  
  // Explicit type detection from column configuration
  if (columnType === 'checkbox') {
    return {
      type: 'boolean',
      filterTypes: ['multi_select'],
      supportsValueFilter: true,
      supportsTextFilter: false
    };
  }
  
  if (columnType === 'dropdown') {
    return {
      type: 'dropdown',
      filterTypes: ['multi_select', 'contains', 'equals'],
      supportsValueFilter: true,
      supportsTextFilter: true,
      dropdownSource: dropdownSources[columnData] || []
    };
  }
  
  // Field name-based type detection (especially important for server-side filtering without sample data)
  if (columnData.includes('count') || columnData.includes('_id') || columnData === 'id') {
    return {
      type: 'number',
      filterTypes: ['equals', 'greater_than', 'less_than', 'range'],
      supportsValueFilter: true,
      supportsTextFilter: true
    };
  }

  // Analyze sample data for type detection
  let detectedType = 'text';
  let hasNumbers = false;
  let hasBooleans = false;
  let hasNulls = false;
  const uniqueValues = new Set();
  
  // Get sample values from data
  const sampleValues = sampleData.slice(0, 100).map(row => {
    return getNestedValue(row, columnData);
  }).filter(val => val !== null && val !== undefined);
  
  // Analyze sample values
  for (const value of sampleValues) {
    if (value === null || value === undefined || value === '') {
      hasNulls = true;
      continue;
    }
    
    uniqueValues.add(value);
    
    if (typeof value === 'boolean') {
      hasBooleans = true;
    } else if (typeof value === 'number' || !isNaN(Number(value))) {
      hasNumbers = true;
    }
    
    // Convert to string for unique values check
    const stringValue = typeof value === 'boolean' 
      ? (value ? 'True' : 'False') 
      : String(value);
    uniqueValues.add(stringValue);
  }
  
  // Determine type based on analysis
  if (hasBooleans || (uniqueValues.size <= 2 && [...uniqueValues].every(v => ['true', 'false', 'True', 'False', '0', '1'].includes(String(v).toLowerCase())))) {
    detectedType = 'boolean';
  } else if (hasNumbers && uniqueValues.size > 10) {
    detectedType = 'number';
  } else if (uniqueValues.size <= 50) {
    detectedType = 'categorical';
  } else {
    detectedType = 'text';
  }
  
  // Special handling for known column patterns
  if (columnData.includes('count') || columnData.includes('_count')) {
    detectedType = 'number';
  } else if (columnData.includes('date') || columnData.includes('time') || header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
    detectedType = 'datetime';
  } else if (columnData === 'wwpn' || columnData.includes('wwpn')) {
    detectedType = 'wwpn';
  } else if (columnData.includes('_details.') || columnData.includes('.')) {
    detectedType = 'nested';
  }
  
  // Return comprehensive type information
  const typeConfig = {
    boolean: {
      type: 'boolean',
      filterTypes: ['multi_select'],
      supportsValueFilter: true,
      supportsTextFilter: false
    },
    number: {
      type: 'number',
      filterTypes: ['equals', 'greater_than', 'less_than', 'range'],
      supportsValueFilter: uniqueValues.size <= 20,
      supportsTextFilter: true
    },
    categorical: {
      type: 'categorical',
      filterTypes: ['multi_select', 'equals', 'contains'],
      supportsValueFilter: true,
      supportsTextFilter: true
    },
    datetime: {
      type: 'datetime',
      filterTypes: ['equals', 'before', 'after', 'range'],
      supportsValueFilter: uniqueValues.size <= 20,
      supportsTextFilter: true
    },
    wwpn: {
      type: 'wwpn',
      filterTypes: ['contains', 'equals', 'starts_with'],
      supportsValueFilter: uniqueValues.size <= 50,
      supportsTextFilter: true
    },
    nested: {
      type: 'nested',
      filterTypes: ['multi_select', 'contains', 'equals'],
      supportsValueFilter: true,
      supportsTextFilter: true
    },
    text: {
      type: 'text',
      filterTypes: ['contains', 'equals', 'starts_with', 'ends_with', 'not_contains'],
      supportsValueFilter: uniqueValues.size <= 50,
      supportsTextFilter: true
    }
  };
  
  return {
    ...typeConfig[detectedType],
    uniqueValues: Array.from(uniqueValues),
    uniqueCount: uniqueValues.size,
    hasNulls,
    dropdownSource: dropdownSources[columnData] || []
  };
};

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - Object to extract value from
 * @param {string} path - Dot-separated path (e.g., 'fabric_details.name')
 * @returns {*} The nested value
 */
export const getNestedValue = (obj, path) => {
  if (!obj || !path) return null;
  
  if (!path.includes('.')) {
    return obj[path];
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return null;
    }
    current = current[key];
  }
  
  return current;
};

/**
 * Set nested value in object using dot notation
 * @param {Object} obj - Object to set value in
 * @param {string} path - Dot-separated path
 * @param {*} value - Value to set
 */
export const setNestedValue = (obj, path, value) => {
  if (!obj || !path) return;
  
  if (!path.includes('.')) {
    obj[path] = value;
    return;
  }
  
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
};

/**
 * Create comprehensive column metadata for filtering
 * @param {Array} columns - Array of column configurations
 * @param {Array} colHeaders - Array of column headers
 * @param {Array} sampleData - Sample data for type detection
 * @param {Object} dropdownSources - Dropdown source configurations
 * @param {Object} visibleColumns - Currently visible columns
 * @returns {Array} Enhanced column metadata
 */
export const createColumnMetadata = (columns, colHeaders, sampleData = [], dropdownSources = {}, visibleColumns = {}) => {
  if (!columns || !colHeaders) return [];
  
  return columns.map((column, index) => {
    const header = colHeaders[index] || `Column ${index + 1}`;
    const isVisible = Array.isArray(visibleColumns) 
      ? visibleColumns.includes(index)
      : visibleColumns[index] === true;
    
    const typeInfo = detectColumnType(column, header, sampleData, dropdownSources);
    
    return {
      index,
      data: column.data,
      header,
      visible: isVisible,
      readOnly: column.readOnly || false,
      required: column.required || false,
      ...typeInfo,
      // Additional metadata
      className: column.className || '',
      width: column.width || null,
      originalColumn: column
    };
  });
};

/**
 * Normalize filter value for consistent comparison
 * @param {*} value - Value to normalize
 * @param {string} columnType - Type of the column
 * @returns {*} Normalized value
 */
export const normalizeFilterValue = (value, columnType) => {
  if (value === null || value === undefined) return null;
  
  switch (columnType) {
    case 'boolean':
      if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
      }
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1' || lower === 'yes') return 'True';
        if (lower === 'false' || lower === '0' || lower === 'no') return 'False';
      }
      return String(value);
    
    case 'number':
      return Number(value);
    
    case 'datetime':
      return new Date(value);
    
    default:
      return String(value).trim();
  }
};

/**
 * Apply a single filter to a data row
 * @param {Object} row - Data row to test
 * @param {Object} filter - Filter configuration
 * @param {Object} columnMetadata - Column metadata
 * @returns {boolean} Whether the row passes the filter
 */
export const applyRowFilter = (row, filter, columnMetadata) => {
  const { index, data: columnData, type: columnType } = columnMetadata;
  const { type: filterType, value: filterValue } = filter;
  
  // Get the actual value from the row
  let rowValue = getNestedValue(row, columnData);
  
  
  // Handle null/undefined values
  if (rowValue === null || rowValue === undefined || rowValue === '') {
    return filterType === 'is_null' || (filterType === 'multi_select' && (!filterValue || filterValue.length === 0));
  }
  
  // Normalize values for comparison
  const normalizedRowValue = normalizeFilterValue(rowValue, columnType);
  const normalizedFilterValue = filterType === 'multi_select' 
    ? (Array.isArray(filterValue) ? filterValue.map(v => normalizeFilterValue(v, columnType)) : [])
    : normalizeFilterValue(filterValue, columnType);
  
  
  // Apply filter based on type
  switch (filterType) {
    case 'contains':
      return String(normalizedRowValue).toLowerCase().includes(String(normalizedFilterValue).toLowerCase());
    
    case 'equals':
      return normalizedRowValue === normalizedFilterValue;
    
    case 'starts_with':
      return String(normalizedRowValue).toLowerCase().startsWith(String(normalizedFilterValue).toLowerCase());
    
    case 'ends_with':
      return String(normalizedRowValue).toLowerCase().endsWith(String(normalizedFilterValue).toLowerCase());
    
    case 'not_contains':
      return !String(normalizedRowValue).toLowerCase().includes(String(normalizedFilterValue).toLowerCase());
    
    case 'multi_select':
      if (!Array.isArray(normalizedFilterValue) || normalizedFilterValue.length === 0) {
        return true; // No filter means show all
      }
      const result = normalizedFilterValue.includes(normalizedRowValue);
      // Debug logging for fabric column
      if (columnData === 'fabric_details.name') {
        console.log('🔍 Multi-select filter debug:', {
          columnData,
          rawRowValue: rowValue,
          normalizedRowValue,
          filterValues: normalizedFilterValue,
          includes: result
        });
      }
      return result;
    
    case 'greater_than':
      return Number(normalizedRowValue) > Number(normalizedFilterValue);
    
    case 'less_than':
      return Number(normalizedRowValue) < Number(normalizedFilterValue);
    
    case 'range':
      if (!Array.isArray(filterValue) || filterValue.length !== 2) return true;
      const [min, max] = filterValue.map(v => Number(normalizeFilterValue(v, columnType)));
      const numValue = Number(normalizedRowValue);
      return numValue >= min && numValue <= max;
    
    case 'before':
      return new Date(normalizedRowValue) < new Date(normalizedFilterValue);
    
    case 'after':
      return new Date(normalizedRowValue) > new Date(normalizedFilterValue);
    
    case 'is_null':
      return rowValue === null || rowValue === undefined || rowValue === '';
    
    case 'is_not_null':
      return rowValue !== null && rowValue !== undefined && rowValue !== '';
    
    default:
      return true;
  }
};

/**
 * Apply all filters to data rows
 * @param {Array} data - Array of data rows
 * @param {Object} filters - Object with column index keys and filter configurations
 * @param {Array} columnMetadata - Array of column metadata
 * @returns {Array} Filtered data rows
 */
export const applyAllFilters = (data, filters, columnMetadata) => {
  if (!data || !Array.isArray(data) || !filters || Object.keys(filters).length === 0) {
    return data;
  }
  
  return data.filter(row => {
    return Object.entries(filters).every(([columnIndex, filter]) => {
      const colIndex = parseInt(columnIndex);
      const columnMeta = columnMetadata.find(col => col.index === colIndex);
      
      if (!columnMeta) return true;
      
      return applyRowFilter(row, filter, columnMeta);
    });
  });
};

/**
 * Get unique values for a column from data
 * @param {Array} data - Array of data rows
 * @param {Object} columnMetadata - Column metadata
 * @param {number} maxValues - Maximum number of unique values to return
 * @returns {Array} Array of unique values
 */
export const getColumnUniqueValues = (data, columnMetadata, maxValues = 100) => {
  if (!data || !Array.isArray(data) || !columnMetadata) return [];
  
  const { data: columnData, type: columnType } = columnMetadata;
  const uniqueValues = new Set();
  
  for (const row of data) {
    const value = getNestedValue(row, columnData);
    if (value !== null && value !== undefined && value !== '') {
      const normalized = normalizeFilterValue(value, columnType);
      uniqueValues.add(normalized);
      
      // Limit the number of unique values for performance
      if (uniqueValues.size >= maxValues) break;
    }
  }
  
  const values = Array.from(uniqueValues);
  
  // Sort values based on type
  if (columnType === 'boolean') {
    return values.sort((a, b) => {
      if (a === 'True' && b === 'False') return -1;
      if (a === 'False' && b === 'True') return 1;
      return 0;
    });
  } else if (columnType === 'number') {
    return values.sort((a, b) => Number(a) - Number(b));
  } else {
    return values.sort((a, b) => String(a).localeCompare(String(b)));
  }
};

/**
 * Generate server-side filter parameters from column filters
 * @param {Object} filters - Client-side filter object
 * @param {Array} columnMetadata - Column metadata array
 * @returns {Object} Server-side filter parameters
 */
export const generateServerFilters = (filters, columnMetadata) => {
  const serverFilters = {};
  
  Object.entries(filters).forEach(([columnIndex, filter]) => {
    const colIndex = parseInt(columnIndex);
    const columnMeta = columnMetadata.find(col => col.index === colIndex);
    
    if (!columnMeta || !filter || !filter.value) return;
    
    const { data: fieldName, type: columnType } = columnMeta;
    const { type: filterType, value: filterValue } = filter;
    
    
    // Map field names for server-side filtering (handle special cases)
    let serverFieldName = fieldName;
    if (fieldName === 'fabric_details.name') {
      serverFieldName = 'fabric__name';
    } else if (fieldName === 'fabric') {
      serverFieldName = 'fabric__name';
    } else if (fieldName === 'host_details.name') {
      serverFieldName = 'host__name';
    } else if (fieldName === 'storage' && !fieldName.includes('__')) {
      serverFieldName = 'storage__name';
    }
    
    // Generate appropriate server-side filter parameters
    switch (filterType) {
      case 'contains':
        serverFilters[`${serverFieldName}__icontains`] = filterValue;
        break;
      
      case 'equals':
        serverFilters[serverFieldName] = filterValue;
        break;
      
      case 'starts_with':
        serverFilters[`${serverFieldName}__istartswith`] = filterValue;
        break;
      
      case 'ends_with':
        serverFilters[`${serverFieldName}__iendswith`] = filterValue;
        break;
      
      case 'multi_select':
        if (Array.isArray(filterValue) && filterValue.length > 0) {
          // Handle boolean values specially
          if (columnType === 'boolean') {
            const boolValues = filterValue.map(v => v === 'True');
            serverFilters[`${serverFieldName}__in`] = boolValues;
          } else if (serverFieldName === 'fabric__name' || serverFieldName === 'host__name' || serverFieldName === 'use') {
            // For fabric, host, and use fields, use regex for multi-select (backend expects this format)
            if (filterValue.length === 1) {
              // For single values, use equals (more efficient than regex)
              serverFilters[serverFieldName] = filterValue[0];
            } else {
              // For multiple values, use regex
              const regexPattern = `^(${filterValue.join('|')})$`;
              serverFilters[`${serverFieldName}__regex`] = regexPattern;
            }
          } else {
            serverFilters[`${serverFieldName}__in`] = filterValue;
          }
        }
        break;
      
      case 'greater_than':
        serverFilters[`${serverFieldName}__gt`] = filterValue;
        break;
      
      case 'less_than':
        serverFilters[`${serverFieldName}__lt`] = filterValue;
        break;
      
      case 'range':
        if (Array.isArray(filterValue) && filterValue.length === 2) {
          // Only add range filters if they have actual values
          if (filterValue[0] !== null && filterValue[0] !== undefined && filterValue[0] !== '') {
            serverFilters[`${serverFieldName}__gte`] = filterValue[0];
          }
          if (filterValue[1] !== null && filterValue[1] !== undefined && filterValue[1] !== '') {
            serverFilters[`${serverFieldName}__lte`] = filterValue[1];
          }
        }
        break;
      
      case 'before':
        serverFilters[`${serverFieldName}__lt`] = filterValue;
        break;
      
      case 'after':
        serverFilters[`${serverFieldName}__gt`] = filterValue;
        break;
      
      case 'is_null':
        serverFilters[`${serverFieldName}__isnull`] = true;
        break;
      
      case 'is_not_null':
        serverFilters[`${serverFieldName}__isnull`] = false;
        break;
    }
  });
  
  return serverFilters;
};