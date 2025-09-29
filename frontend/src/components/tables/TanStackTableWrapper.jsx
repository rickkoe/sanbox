import React, { forwardRef } from 'react';
import TanStackTable from './TanStackTable/TanStackTable';

/**
 * TanStackTableWrapper - Drop-in replacement for GenericTable
 *
 * This wrapper provides the exact same API as GenericTable to enable
 * seamless migration from Handsontable to TanStack Table.
 *
 * Usage: Simply replace 'GenericTable' imports with 'TanStackTableWrapper'
 */
const TanStackTableWrapper = forwardRef(({
  // Core API props (match GenericTable exactly)
  apiUrl,
  apiParams = {},
  saveUrl,
  deleteUrl,
  saveTransform,
  columns,
  colHeaders,
  newRowTemplate,
  dropdownSources = {},
  onBuildPayload,
  onSave,
  onDelete,
  navigationRedirectPath,
  customRenderers = {},
  preprocessData,
  colWidths,
  getCellsConfig,
  fixedColumnsLeft = 0,
  columnSorting = false,
  filters = false,
  dropdownMenu = false,
  beforeSave,
  afterSave,
  afterChange,
  additionalButtons,
  headerButtons,
  storageKey,
  height = "100%",
  getExportFilename,

  // Additional GenericTable props that might exist
  ...otherProps
}, ref) => {

  // Determine if server pagination should be enabled
  const serverPagination = Boolean(apiUrl);

  return (
    <TanStackTable
      ref={ref}
      // Core data and API
      apiUrl={apiUrl}
      apiParams={apiParams}
      saveUrl={saveUrl}
      deleteUrl={deleteUrl}

      // Column configuration
      columns={columns}
      colHeaders={colHeaders}
      dropdownSources={dropdownSources}
      customRenderers={customRenderers}
      colWidths={colWidths}

      // Table behavior
      serverPagination={serverPagination}
      enableVirtualization={true}
      enableRowSelection={true}
      enableFiltering={filters}
      enableSorting={columnSorting}
      enableExport={true}

      // Excel-like features
      enableCopyPaste={true}
      enableFillOperations={true}
      enableKeyboardNavigation={true}

      // Editing
      enableEditing={true}
      newRowTemplate={newRowTemplate}

      // Events
      onSave={onSave}
      onDelete={onDelete}
      beforeSave={beforeSave}
      afterSave={afterSave}
      onDataChange={afterChange}

      // UI customization
      height={height}
      storageKey={storageKey}
      tableName={storageKey || 'table'}

      // Migration compatibility
      preprocessData={preprocessData}
      saveTransform={saveTransform}
      getCellsConfig={getCellsConfig}

      // Pass through any additional props
      {...otherProps}
    />
  );
});

TanStackTableWrapper.displayName = 'TanStackTableWrapper';

export default TanStackTableWrapper;