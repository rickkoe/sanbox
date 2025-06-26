import React from 'react';

const TablePagination = ({
  currentPage,
  totalPages,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 500, "All"]
}) => {
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = pageSize === "All" ? totalRows : Math.min(currentPage * pageSize, totalRows);

  const getVisiblePages = () => {
    const maxVisible = 5;
    const pages = [];
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="table-pagination">
      <div className="pagination-info">
        <span className="pagination-text">
          Showing {startRow} to {endRow} of {totalRows} entries
        </span>
        
        <div className="page-size-selector">
          <label htmlFor="pageSize" className="page-size-label">
            Show:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => {
              const newSize = e.target.value === "All" ? "All" : parseInt(e.target.value);
              onPageSizeChange(newSize);
            }}
            className="page-size-select"
          >
            {pageSizeOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span className="page-size-text">entries</span>
        </div>
      </div>

      {totalPages > 1 && pageSize !== "All" && (
        <div className="pagination-controls">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="pagination-btn pagination-btn-first"
            title="First page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="11,17 6,12 11,7"/>
              <polyline points="18,17 13,12 18,7"/>
            </svg>
          </button>
          
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn pagination-btn-prev"
            title="Previous page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>

          <div className="pagination-pages">
            {currentPage > 3 && totalPages > 5 && (
              <>
                <button
                  onClick={() => onPageChange(1)}
                  className="pagination-btn pagination-btn-page"
                >
                  1
                </button>
                <span className="pagination-ellipsis">...</span>
              </>
            )}
            
            {visiblePages.map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`pagination-btn pagination-btn-page ${
                  page === currentPage ? 'active' : ''
                }`}
              >
                {page}
              </button>
            ))}
            
            {currentPage < totalPages - 2 && totalPages > 5 && (
              <>
                <span className="pagination-ellipsis">...</span>
                <button
                  onClick={() => onPageChange(totalPages)}
                  className="pagination-btn pagination-btn-page"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-btn pagination-btn-next"
            title="Next page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
          
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="pagination-btn pagination-btn-last"
            title="Last page"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="13,17 18,12 13,7"/>
              <polyline points="6,17 11,12 6,7"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default TablePagination;