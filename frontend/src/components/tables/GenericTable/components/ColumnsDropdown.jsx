import React, { useState } from 'react';

const ColumnsDropdown = ({
  columns,
  colHeaders,
  visibleColumns,
  columnFilter,
  setColumnFilter,
  toggleColumnVisibility,
  toggleAllColumns,
  isRequiredColumn
}) => {
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);

  const filteredColumns = columns.filter((col, index) => {
    const columnName = (colHeaders[index] || col.data).toLowerCase();
    return columnName.includes(columnFilter.toLowerCase());
  });

  return (
    <div className="export-dropdown" style={{ position: 'relative' }}>
      <button 
        className="modern-btn modern-btn-secondary dropdown-toggle"
        onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
        onBlur={(e) => {
          const dropdownContainer = e.currentTarget.parentElement;
          if (!dropdownContainer.contains(e.relatedTarget)) {
            setTimeout(() => setShowColumnsDropdown(false), 150);
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="9"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
        </svg>
        Columns
      </button>
      
      <div 
        className={`dropdown-menu columns-dropdown-menu ${showColumnsDropdown ? 'show' : ''}`}
        style={{
          opacity: showColumnsDropdown ? 1 : 0,
          visibility: showColumnsDropdown ? 'visible' : 'hidden',
          transform: showColumnsDropdown ? 'translateY(0)' : 'translateY(-10px)',
          minWidth: '220px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}
        onMouseDown={(e) => {
          if (e.target.tagName !== 'INPUT') {
            e.preventDefault();
          }
        }}
      >
        {/* Search Filter */}
        <div className="dropdown-filter">
          <input
            type="text"
            placeholder="Search columns..."
            value={columnFilter}
            onChange={(e) => setColumnFilter(e.target.value)}
            className="filter-input"
            autoComplete="off"
            tabIndex={0}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="filter-icon">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>

        {/* Select All Checkbox */}
        <div className="dropdown-select-all">
          <label 
            className="dropdown-checkbox-item select-all-item"
            onMouseDown={(e) => e.preventDefault()}
          >
            <input
              type="checkbox"
              checked={Object.values(visibleColumns).every(visible => visible)}
              ref={(el) => {
                if (el) {
                  const someVisible = Object.values(visibleColumns).some(visible => visible);
                  const allVisible = Object.values(visibleColumns).every(visible => visible);
                  el.indeterminate = someVisible && !allVisible;
                }
              }}
              onChange={(e) => toggleAllColumns(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontWeight: '600', color: '#2563eb' }}>
              {Object.values(visibleColumns).every(visible => visible) ? 'Unselect All' : 'Select All'}
            </span>
          </label>
        </div>

        {/* Column List */}
        <div className="dropdown-columns-list">
          {filteredColumns.map((col, filteredIndex) => {
            const originalIndex = columns.findIndex(originalCol => originalCol === col);
            const isRequired = isRequiredColumn(originalIndex);
            const isChecked = visibleColumns[originalIndex];
            
            return (
              <label 
                key={originalIndex}
                className="dropdown-checkbox-item"
                style={{ 
                  cursor: isRequired ? 'not-allowed' : 'pointer', 
                  userSelect: 'none',
                  opacity: isRequired ? 0.7 : 1,
                  backgroundColor: isRequired ? '#f3f4f6' : 'transparent'
                }}
                onMouseDown={(e) => e.preventDefault()}
                title={isRequired ? 'This column is required and cannot be hidden' : ''}
              >
                <input
                  type="checkbox"
                  checked={isChecked || false} 
                  disabled={isRequired && isChecked}
                  onChange={(e) => {
                    if (!isRequired || !isChecked) {
                      toggleColumnVisibility(originalIndex);
                    }
                  }}
                  style={{ 
                    marginRight: '8px',
                    cursor: isRequired && isChecked ? 'not-allowed' : 'pointer'
                  }}
                />
                <span style={{
                  fontWeight: isRequired ? '600' : 'normal',
                  color: isRequired ? '#1f2937' : '#374151'
                }}>
                  {colHeaders[originalIndex] || col.data}
                  {isRequired && (
                    <span style={{ 
                      marginLeft: '8px', 
                      fontSize: '10px', 
                      color: '#059669',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      REQUIRED
                    </span>
                  )}
                </span>
              </label>
            );
          })}
          {filteredColumns.length === 0 && columnFilter && (
            <div className="no-results">
              <span>No columns found matching "{columnFilter}"</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="columns-dropdown-footer">
          <button 
            onClick={() => {
              setColumnFilter('');
              setShowColumnsDropdown(false);
            }} 
            className="dropdown-item"
            style={{ fontWeight: '500', color: '#6b7280' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnsDropdown;