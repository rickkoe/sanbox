import React from 'react';
import { flexRender } from '@tanstack/react-table';

/**
 * Create TanStack Table column definitions from GenericTable format
 * Converts GenericTable column config to TanStack Table column definitions
 */
export function createColumnDefinitions(
  columns = [],
  colHeaders = [],
  customRenderers = {},
  dropdownSources = {},
  options = {}
) {
  const {
    enableSorting = true,
    enableFiltering = true,
    enableRowSelection = false,
    enableEditing = false,
    getCellsConfig,
  } = options;

  const columnDefs = [];

  // Add row selection column if enabled
  if (enableRowSelection) {
    columnDefs.push(createSelectionColumn());
  }

  // Convert GenericTable columns to TanStack format
  columns.forEach((column, index) => {
    const headerName = colHeaders[index] || column.header || column.data || `Column ${index + 1}`;
    const accessorKey = column.data || column.accessorKey || `column_${index}`;

    // Get dropdown source
    const dropdownSource = dropdownSources[accessorKey] || dropdownSources[headerName];

    // Determine column type
    const columnType = column.type || inferColumnType(column, dropdownSource, accessorKey);

    // Create column definition
    const columnDef = {
      id: accessorKey,
      accessorKey,
      header: headerName,

      // Cell rendering
      cell: ({ row, column, getValue, table }) => {
        const value = getValue();
        const cellConfig = getCellsConfig ? getCellsConfig(table, row.index, column.getIndex?.() || index, accessorKey) : {};

        // Use custom renderer if available (adapted for React)
        if (customRenderers[accessorKey] || customRenderers[headerName]) {
          const customRenderer = customRenderers[accessorKey] || customRenderers[headerName];

          // For GenericTable compatibility, create a mock DOM element to capture the text
          const mockTd = {
            innerText: '',
            innerHTML: '',
            set innerText(text) { this._text = String(text); },
            get innerText() { return this._text || ''; }
          };

          try {
            // Call the custom renderer with GenericTable-style parameters
            const result = customRenderer(null, mockTd, row.index, index, accessorKey, value);

            // Return the text content that was set by the renderer
            return <span>{mockTd.innerText || String(value || '')}</span>;
          } catch (error) {
            console.warn('Custom renderer error:', error);
            return <span>{String(value || '')}</span>;
          }
        }

        // Use type-specific cell component
        return createCellRenderer(value, columnType, dropdownSource, cellConfig, enableEditing);
      },

      // Header rendering
      header: ({ column }) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: enableSorting ? 'pointer' : 'default',
          }}
        >
          <span>{headerName}</span>
          {enableSorting && renderSortIndicator(column)}
          {enableFiltering && renderFilterIndicator(column)}
        </div>
      ),

      // Column configuration
      enableSorting: enableSorting && (column.sorting !== false),
      enableColumnFilter: enableFiltering && (column.filtering !== false),
      enableGlobalFilter: enableFiltering,

      // Column metadata
      meta: {
        type: columnType,
        dropdownSource,
        originalColumn: column,
        cellConfig: getCellsConfig,
        ...column.meta,
      },

      // Sizing
      size: column.width || getColumnWidth(headerName, columnType),
      minSize: 50,
      maxSize: 800,

      // Sorting
      sortingFn: getSortingFunction(columnType),

      // Filtering
      filterFn: getFilterFunction(columnType),
    };

    columnDefs.push(columnDef);
  });

  return columnDefs;
}

/**
 * Create row selection column
 */
function createSelectionColumn() {
  return {
    id: 'select',
    header: ({ table }) => (
      <IndeterminateCheckbox
        {...{
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
          onChange: table.getToggleAllRowsSelectedHandler(),
        }}
      />
    ),
    cell: ({ row }) => (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <IndeterminateCheckbox
          {...{
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            indeterminate: row.getIsSomeSelected(),
            onChange: row.getToggleSelectedHandler(),
          }}
        />
      </div>
    ),
    size: 50,
    minSize: 50,
    maxSize: 50,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  };
}

/**
 * Create cell renderer based on column type
 */
function createCellRenderer(value, columnType, dropdownSource, cellConfig, enableEditing) {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>;
  }

  switch (columnType) {
    case 'boolean':
      return <BooleanCell value={value} editable={enableEditing} />;

    case 'select':
    case 'dropdown':
      return (
        <DropdownCell
          value={value}
          options={dropdownSource}
          editable={enableEditing}
          config={cellConfig}
        />
      );

    case 'number':
    case 'integer':
      return <NumberCell value={value} editable={enableEditing} />;

    case 'date':
      return <DateCell value={value} editable={enableEditing} />;

    case 'url':
      return <URLCell value={value} />;

    case 'email':
      return <EmailCell value={value} />;

    default:
      return <TextCell value={value} editable={enableEditing} config={cellConfig} />;
  }
}

/**
 * Cell Components
 */
function TextCell({ value, editable, config = {} }) {
  const displayValue = String(value || '');

  if (!editable) {
    return (
      <span
        title={displayValue}
        style={{
          ...getCellStyle(config),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayValue}
      </span>
    );
  }

  // TODO: Implement inline editing
  return (
    <span
      title={displayValue}
      style={getCellStyle(config)}
    >
      {displayValue}
    </span>
  );
}

function BooleanCell({ value, editable }) {
  const boolValue = Boolean(value);

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {editable ? (
        <input
          type="checkbox"
          checked={boolValue}
          onChange={() => {
            // TODO: Implement change handler
          }}
          style={{ cursor: 'pointer' }}
        />
      ) : (
        <span
          style={{
            color: boolValue ? '#27ae60' : '#e74c3c',
            fontWeight: '600',
          }}
        >
          {boolValue ? '✓' : '✗'}
        </span>
      )}
    </div>
  );
}

function DropdownCell({ value, options = [], editable, config = {} }) {
  const displayValue = String(value || '');

  if (!editable) {
    return (
      <span
        title={displayValue}
        style={{
          ...getCellStyle(config),
          backgroundColor: value ? '#f8f9fa' : 'transparent',
          padding: value ? '2px 8px' : '0',
          borderRadius: value ? '4px' : '0',
          border: value ? '1px solid #e0e0e0' : 'none',
        }}
      >
        {displayValue}
      </span>
    );
  }

  // TODO: Implement dropdown editing
  return <span style={getCellStyle(config)}>{displayValue}</span>;
}

function NumberCell({ value, editable }) {
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  const isValid = !isNaN(numValue);

  return (
    <span
      style={{
        textAlign: 'right',
        fontFamily: 'monospace',
        color: isValid ? '#333' : '#e74c3c',
      }}
    >
      {isValid ? numValue.toLocaleString() : String(value || '')}
    </span>
  );
}

function DateCell({ value, editable }) {
  if (!value) return <span style={{ color: '#999' }}>—</span>;

  const date = new Date(value);
  const isValid = !isNaN(date.getTime());

  return (
    <span
      style={{
        fontFamily: 'monospace',
        color: isValid ? '#333' : '#e74c3c',
      }}
    >
      {isValid ? date.toLocaleDateString() : String(value)}
    </span>
  );
}

function URLCell({ value }) {
  if (!value) return <span style={{ color: '#999' }}>—</span>;

  const urlString = String(value);
  const isValidURL = urlString.startsWith('http') || urlString.startsWith('www');

  return isValidURL ? (
    <a
      href={urlString.startsWith('www') ? `https://${urlString}` : urlString}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: '#3498db',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.target.style.textDecoration = 'underline';
      }}
      onMouseLeave={(e) => {
        e.target.style.textDecoration = 'none';
      }}
    >
      {urlString}
    </a>
  ) : (
    <span>{urlString}</span>
  );
}

function EmailCell({ value }) {
  if (!value) return <span style={{ color: '#999' }}>—</span>;

  const emailString = String(value);
  const isValidEmail = emailString.includes('@');

  return isValidEmail ? (
    <a
      href={`mailto:${emailString}`}
      style={{
        color: '#3498db',
        textDecoration: 'none',
      }}
    >
      {emailString}
    </a>
  ) : (
    <span>{emailString}</span>
  );
}

/**
 * Indeterminate checkbox for row selection
 */
function IndeterminateCheckbox({ indeterminate, className = '', ...rest }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      className={className}
      style={{ cursor: 'pointer' }}
      {...rest}
    />
  );
}

/**
 * Helper Functions
 */
function inferColumnType(column, dropdownSource, accessorKey) {
  // Check column type
  if (column.type) return column.type;

  // Check if dropdown
  if (dropdownSource) return 'select';

  // Infer from accessor key
  const key = (accessorKey || '').toLowerCase();

  if (key.includes('date') || key.includes('time')) return 'date';
  if (key.includes('count') || key.includes('number') || key.includes('size')) return 'number';
  if (key.includes('is_') || key.includes('has_') || key.includes('enabled')) return 'boolean';
  if (key.includes('url') || key.includes('link')) return 'url';
  if (key.includes('email') || key.includes('mail')) return 'email';

  return 'text';
}

function getColumnWidth(headerName, columnType) {
  // Base width on header length
  const baseWidth = Math.max(80, headerName.length * 8 + 40);

  // Type-specific adjustments
  switch (columnType) {
    case 'boolean': return 80;
    case 'date': return 120;
    case 'number': return 100;
    case 'select': return Math.max(baseWidth, 150);
    default: return Math.min(baseWidth, 200);
  }
}

function getCellStyle(config = {}) {
  const style = {};

  if (config.className?.includes('invalid-fabric-member')) {
    style.color = '#dc2626';
    style.backgroundColor = '#fef2f2';
    style.fontWeight = 'bold';
    style.border = '2px solid #dc2626';
  }

  return style;
}

function renderSortIndicator(column) {
  const sorted = column.getIsSorted();

  if (sorted === 'asc') {
    return <span style={{ color: '#3498db' }}>🔼</span>;
  }
  if (sorted === 'desc') {
    return <span style={{ color: '#3498db' }}>🔽</span>;
  }
  return <span style={{ opacity: 0.3 }}>↕️</span>;
}

function renderFilterIndicator(column) {
  const isFiltered = column.getFilterValue() != null;

  return isFiltered ? (
    <span style={{ color: '#e74c3c' }}>🔍</span>
  ) : (
    <span style={{ opacity: 0.3 }}>⚪</span>
  );
}

function getSortingFunction(columnType) {
  switch (columnType) {
    case 'number':
    case 'integer':
      return 'basic'; // TanStack Table's basic numeric sort

    case 'date':
      return (rowA, rowB, columnId) => {
        const dateA = new Date(rowA.getValue(columnId));
        const dateB = new Date(rowB.getValue(columnId));
        return dateA.getTime() - dateB.getTime();
      };

    case 'boolean':
      return (rowA, rowB, columnId) => {
        const valA = Boolean(rowA.getValue(columnId));
        const valB = Boolean(rowB.getValue(columnId));
        return valA === valB ? 0 : valA ? 1 : -1;
      };

    default:
      return 'text'; // TanStack Table's text sort
  }
}

function getFilterFunction(columnType) {
  switch (columnType) {
    case 'boolean':
      return 'equals';

    case 'number':
    case 'integer':
      return 'inNumberRange';

    case 'date':
      return 'inDateRange';

    case 'select':
    case 'dropdown':
      return 'arrIncludesSome';

    default:
      return 'includesString';
  }
}