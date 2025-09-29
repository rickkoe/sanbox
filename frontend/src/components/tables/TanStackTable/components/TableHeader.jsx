import React, { useState } from 'react';

/**
 * Table header component with controls and actions
 * Provides save, export, filtering, and other table actions
 */
export function TableHeader({
  table,
  isDirty = false,
  isLoading = false,
  onSave,
  onExportCSV,
  onExportExcel,
  filtering,
  enableExport = true,
  additionalButtons = [],
  className = '',
  style = {},
}) {
  const [showFilters, setShowFilters] = useState(false);

  // Get table statistics
  const stats = {
    totalRows: table?.getRowModel().rows.length || 0,
    filteredRows: table?.getFilteredRowModel().rows.length || 0,
    selectedRows: table?.getSelectedRowModel().rows.length || 0,
    hasFilters: filtering?.filterStats?.hasAnyFilters || false,
  };

  return (
    <div
      className={`table-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        flexWrap: 'wrap',
        gap: '16px',
        minHeight: '64px',
        ...style,
      }}
    >
      {/* Left section - Info and filters */}
      <div
        className="header-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flex: 1,
        }}
      >
        {/* Table statistics */}
        <div
          className="table-stats"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '14px',
            color: '#666',
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
              }}
            >
              {stats.selectedRows} selected
            </span>
          )}

          {isDirty && (
            <span
              style={{
                color: '#e74c3c',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#e74c3c',
                  borderRadius: '50%',
                }}
              />
              Unsaved changes
            </span>
          )}
        </div>

        {/* Global search */}
        <div className="global-search" style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search all columns..."
            value={table?.getState().globalFilter || ''}
            onChange={(e) => table?.setGlobalFilter(e.target.value)}
            disabled={isLoading}
            style={{
              padding: '8px 12px 8px 32px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              width: '250px',
              backgroundColor: isLoading ? '#f5f5f5' : 'white',
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

        {/* Filter toggle */}
        {filtering && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            disabled={isLoading}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: showFilters ? '#3498db' : 'white',
              color: showFilters ? 'white' : '#333',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            🔧 Filters
            {stats.hasFilters && (
              <span
                style={{
                  backgroundColor: showFilters ? 'rgba(255,255,255,0.2)' : '#e74c3c',
                  color: showFilters ? 'white' : 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {filtering.filterStats?.filteredColumns || 0}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Right section - Actions */}
      <div
        className="header-right"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {/* Additional buttons */}
        {additionalButtons.map((button, index) => (
          <button
            key={index}
            onClick={button.onClick}
            disabled={isLoading || button.disabled}
            title={button.title}
            style={{
              padding: '8px 12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: button.variant === 'primary' ? '#3498db' : 'white',
              color: button.variant === 'primary' ? 'white' : '#333',
              cursor: (isLoading || button.disabled) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: button.variant === 'primary' ? '600' : '400',
              opacity: (isLoading || button.disabled) ? 0.6 : 1,
              ...button.style,
            }}
          >
            {button.icon && <span style={{ marginRight: '4px' }}>{button.icon}</span>}
            {button.label}
          </button>
        ))}

        {/* Export dropdown */}
        {enableExport && (onExportCSV || onExportExcel) && (
          <ExportDropdown
            onExportCSV={onExportCSV}
            onExportExcel={onExportExcel}
            disabled={isLoading}
            selectedCount={stats.selectedRows}
          />
        )}

        {/* Save button */}
        {onSave && (
          <button
            onClick={onSave}
            disabled={!isDirty || isLoading}
            style={{
              padding: '8px 16px',
              border: '1px solid #27ae60',
              borderRadius: '4px',
              backgroundColor: isDirty ? '#27ae60' : '#95a5a6',
              color: 'white',
              cursor: (!isDirty || isLoading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isLoading ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Saving...
              </>
            ) : (
              <>
                💾 Save Changes
                {isDirty && (
                  <span
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      borderRadius: '10px',
                      padding: '2px 6px',
                      fontSize: '12px',
                    }}
                  >
                    !
                  </span>
                )}
              </>
            )}
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Export dropdown component
 */
function ExportDropdown({
  onExportCSV,
  onExportExcel,
  disabled = false,
  selectedCount = 0,
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExport = (type, options = {}) => {
    if (type === 'csv' && onExportCSV) {
      onExportCSV(options);
    } else if (type === 'excel' && onExportExcel) {
      onExportExcel(options);
    }
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={disabled}
        style={{
          padding: '8px 12px',
          border: '1px solid #3498db',
          borderRadius: '4px',
          backgroundColor: 'white',
          color: '#3498db',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        📊 Export ▾
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown menu */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '200px',
              padding: '8px 0',
            }}
          >
            <div
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                color: '#666',
                fontWeight: '600',
                textTransform: 'uppercase',
                borderBottom: '1px solid #eee',
                marginBottom: '4px',
              }}
            >
              Export Options
            </div>

            {/* All data */}
            <ExportMenuItem
              label="All Data as CSV"
              icon="📄"
              onClick={() => handleExport('csv', { visibleOnly: false })}
            />
            <ExportMenuItem
              label="All Data as Excel"
              icon="📈"
              onClick={() => handleExport('excel', { visibleOnly: false })}
            />

            <hr style={{ margin: '8px 0', border: '0', borderTop: '1px solid #eee' }} />

            {/* Filtered data */}
            <ExportMenuItem
              label="Filtered Data as CSV"
              icon="📄"
              onClick={() => handleExport('csv', { visibleOnly: true })}
            />
            <ExportMenuItem
              label="Filtered Data as Excel"
              icon="📈"
              onClick={() => handleExport('excel', { visibleOnly: true })}
            />

            {/* Selected data */}
            {selectedCount > 0 && (
              <>
                <hr style={{ margin: '8px 0', border: '0', borderTop: '1px solid #eee' }} />
                <ExportMenuItem
                  label={`Selected Rows (${selectedCount}) as CSV`}
                  icon="✅"
                  onClick={() => handleExport('csv', { selectedOnly: true })}
                />
                <ExportMenuItem
                  label={`Selected Rows (${selectedCount}) as Excel`}
                  icon="✅"
                  onClick={() => handleExport('excel', { selectedOnly: true })}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Export menu item component
 */
function ExportMenuItem({ label, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '8px 16px',
        border: 'none',
        backgroundColor: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#333',
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = 'transparent';
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}