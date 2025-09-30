import React from 'react';
import { AdvancedFilterDropdown } from './filters/AdvancedFilterDropdown';

/**
 * Filter Toolbar Component
 * Contains search, filtering, and data display controls separate from CRUD operations
 */
export function FilterToolbar({
  table,
  columns = [],
  dropdownSources = {},
  onFilterChange,
  className = '',
  style = {},
}) {
  // Get table statistics
  const stats = {
    totalRows: table?.getRowModel().rows.length || 0,
    filteredRows: table?.getFilteredRowModel().rows.length || 0,
    selectedRows: table?.getSelectedRowModel().rows.length || 0,
    hasFilters: (table?.getState().columnFilters?.length || 0) > 0 || (table?.getState().globalFilter || '').length > 0,
  };

  return (
    <div
      className={`filter-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e0e0e0',
        flexWrap: 'wrap',
        gap: '12px',
        minHeight: '56px',
        ...style,
      }}
    >
      {/* Left section - Search and Filters */}
      <div
        className="filter-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1,
        }}
      >
        {/* Global search */}
        <div className="global-search" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search all columns..."
            value={table?.getState().globalFilter || ''}
            onChange={(e) => table?.setGlobalFilter(e.target.value)}
            style={{
              padding: '8px 12px 8px 32px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              width: '250px',
              backgroundColor: 'white',
            }}
          />
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#999',
              fontSize: '16px',
            }}
          >
            🔍
          </span>
        </div>

        {/* Advanced Filter Dropdown */}
        <AdvancedFilterDropdown
          table={table}
          columns={columns}
          dropdownSources={dropdownSources}
          onFilterChange={onFilterChange}
        />
      </div>

      {/* Right section - Info and Stats */}
      <div
        className="filter-right"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '14px',
          color: '#666',
        }}
      >
        {/* Table statistics */}
        <div
          className="table-stats"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <span>
            {stats.filteredRows.toLocaleString()} rows
            {stats.hasFilters && stats.totalRows !== stats.filteredRows && (
              <span style={{ color: '#3498db' }}>
                {' '}(filtered from {stats.totalRows.toLocaleString()})
              </span>
            )}
          </span>

          {stats.selectedRows > 0 && (
            <span
              style={{
                color: '#e67e22',
                fontWeight: '600',
                padding: '4px 8px',
                backgroundColor: '#fff3cd',
                borderRadius: '4px',
                border: '1px solid #ffeaa7',
              }}
            >
              {stats.selectedRows} selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default FilterToolbar;