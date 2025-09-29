import React from 'react';

const StatsContainer = ({ 
  unsavedData, 
  hasNonEmptyValues, 
  selectedCount, 
  quickSearch, 
  isDirty,
  pagination = null 
}) => {
  // Handle server pagination vs client-side data
  const isServerPagination = pagination && typeof pagination.totalCount === 'number';
  const totalRows = isServerPagination ? pagination.totalCount : unsavedData.filter(row => hasNonEmptyValues(row)).length;
  const displayedRows = isServerPagination ? pagination.data.length : totalRows;
  

  return (
    <div className="stats-container">
      {isServerPagination ? (
        <>
          {/* Server pagination stats */}
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{totalRows}</span>
          </div>
          
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-label">Page</span>
            <span className="stat-value">{pagination.currentPage || 1} of {pagination.totalPages || 1}</span>
          </div>
          
          <div className="stat-divider"></div>
          <div className="stat-item">
            <span className="stat-label">Showing</span>
            <span className="stat-value">{displayedRows}</span>
          </div>
        </>
      ) : (
        <>
          {/* Client-side pagination stats */}
          <div className="stat-item">
            <span className="stat-label">Total</span>
            <span className="stat-value">{pagination?.totalRows || totalRows}</span>
          </div>
          
          {pagination && pagination.pageSize !== "All" && (
            <>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-label">Page</span>
                <span className="stat-value">{pagination.currentPage} of {pagination.totalPages}</span>
              </div>
              
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-label">Showing</span>
                <span className="stat-value">{pagination.endRow - pagination.startRow + 1}</span>
              </div>
            </>
          )}
          
          {pagination && pagination.filteredRows && pagination.filteredRows !== pagination.totalRows && (
            <>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-label">Filtered</span>
                <span className="stat-value">{pagination.filteredRows}</span>
              </div>
            </>
          )}
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