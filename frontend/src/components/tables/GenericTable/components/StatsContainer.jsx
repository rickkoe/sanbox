import React from 'react';

const StatsContainer = ({ 
  unsavedData, 
  hasNonEmptyValues, 
  selectedCount, 
  quickSearch, 
  isDirty,
  pagination = null 
}) => {
  const totalRows = unsavedData.filter(row => hasNonEmptyValues(row)).length;
  const displayedRows = pagination ? pagination.paginatedData.filter(row => hasNonEmptyValues(row)).length : totalRows;

  return (
    <div className="stats-container">
      <div className="stat-item">
        <span className="stat-label">Total</span>
        <span className="stat-value">{totalRows}</span>
      </div>
      
      {pagination && pagination.pageSize !== "All" && (
        <>
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-label">Showing</span>
            <span className="stat-value">{displayedRows}</span>
          </div>
        </>
      )}
      
      <div className="stat-divider"></div>
      <div className="stat-item">
        <span className="stat-label">Selected</span>
        <span className="stat-value">{selectedCount}</span>
      </div>
      
      {quickSearch && (
        <>
          <div className="stat-divider"></div>
          <div className="search-indicator">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <span>Filtered</span>
          </div>
        </>
      )}
      
      {isDirty && (
        <>
          <div className="stat-divider"></div>
          <div className="unsaved-indicator">
            <div className="unsaved-dot"></div>
            <span>Unsaved changes</span>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsContainer;