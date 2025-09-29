import React, { useState } from 'react';

/**
 * Pagination component for TanStack Table
 * Supports both client-side and server-side pagination
 */
export function Pagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 50,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  loading = false,
  showPageSizeSelector = true,
  showPageInfo = true,
  showPageNumbers = true,
  maxPageNumbers = 7,
  pageSizeOptions = [10, 25, 50, 100, 'All'],
  className = '',
  style = {},
}) {
  const [pageInput, setPageInput] = useState('');

  // Calculate display info
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * (pageSize === 'All' ? totalItems : pageSize) + 1;
  const endItem = pageSize === 'All' ? totalItems : Math.min(currentPage * pageSize, totalItems);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || loading) return;
    if (onPageChange) onPageChange(newPage);
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize) => {
    if (onPageSizeChange) onPageSizeChange(newPageSize);
  };

  // Handle direct page input
  const handlePageInputSubmit = () => {
    const pageNumber = parseInt(pageInput, 10);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      handlePageChange(pageNumber);
    }
    setPageInput('');
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    if (totalPages <= maxPageNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages = [];
    const halfRange = Math.floor(maxPageNumbers / 2);

    let start = Math.max(1, currentPage - halfRange);
    let end = Math.min(totalPages, currentPage + halfRange);

    // Adjust if we're near the beginning or end
    if (end - start + 1 < maxPageNumbers) {
      if (start === 1) {
        end = Math.min(totalPages, start + maxPageNumbers - 1);
      } else {
        start = Math.max(1, end - maxPageNumbers + 1);
      }
    }

    // Always show first page
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Always show last page
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = showPageNumbers ? getPageNumbers() : [];

  return (
    <div
      className={`table-pagination ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 0',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        flexWrap: 'wrap',
        gap: '16px',
        minHeight: '64px',
        ...style,
      }}
    >
      {/* Page info */}
      {showPageInfo && (
        <div
          className="page-info"
          style={{
            fontSize: '14px',
            color: '#666',
            fontWeight: '500',
          }}
        >
          {totalItems === 0 ? (
            'No items'
          ) : (
            <>
              Showing {startItem.toLocaleString()} to{' '}
              {endItem.toLocaleString()} of{' '}
              {totalItems.toLocaleString()} items
              {totalPages > 1 && (
                <span style={{ marginLeft: '8px', color: '#999' }}>
                  (Page {currentPage} of {totalPages})
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* Navigation controls */}
      <div
        className="pagination-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        {/* Go to page input */}
        <div
          className="page-input-group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
          }}
        >
          <span>Go to:</span>
          <input
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handlePageInputSubmit();
              }
            }}
            placeholder={currentPage.toString()}
            disabled={loading || totalPages <= 1}
            style={{
              width: '60px',
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              textAlign: 'center',
            }}
          />
          <button
            onClick={handlePageInputSubmit}
            disabled={loading || !pageInput || totalPages <= 1}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
            }}
          >
            Go
          </button>
        </div>

        {/* Navigation buttons */}
        <div className="nav-buttons" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* First page */}
          <PaginationButton
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || loading}
            title="First page"
          >
            «
          </PaginationButton>

          {/* Previous page */}
          <PaginationButton
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            title="Previous page"
          >
            ‹
          </PaginationButton>

          {/* Page numbers */}
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  style={{
                    padding: '8px 4px',
                    color: '#999',
                    fontSize: '14px',
                  }}
                >
                  ...
                </span>
              );
            }

            return (
              <PaginationButton
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                disabled={loading}
                active={pageNum === currentPage}
                title={`Go to page ${pageNum}`}
              >
                {pageNum}
              </PaginationButton>
            );
          })}

          {/* Next page */}
          <PaginationButton
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            title="Next page"
          >
            ›
          </PaginationButton>

          {/* Last page */}
          <PaginationButton
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages || loading}
            title="Last page"
          >
            »
          </PaginationButton>
        </div>
      </div>

      {/* Page size selector */}
      {showPageSizeSelector && (
        <div
          className="page-size-selector"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
          }}
        >
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const value = e.target.value === 'All' ? 'All' : parseInt(e.target.value, 10);
              handlePageSizeChange(value);
            }}
            disabled={loading}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div
          className="pagination-loading"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#666',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid #f0f0f0',
              borderTop: '2px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Loading...
        </div>
      )}

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
 * Individual pagination button component
 */
function PaginationButton({
  onClick,
  disabled = false,
  active = false,
  children,
  title,
  className = '',
  style = {},
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`pagination-button ${active ? 'active' : ''} ${className}`}
      style={{
        padding: '8px 12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        backgroundColor: active ? '#3498db' : 'white',
        color: active ? 'white' : disabled ? '#999' : '#333',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '14px',
        fontWeight: active ? '600' : '400',
        minWidth: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        ...style,
        ...(disabled ? {
          opacity: 0.5,
          cursor: 'not-allowed',
        } : {}),
        ...(active ? {
          backgroundColor: '#3498db',
          color: 'white',
          borderColor: '#3498db',
        } : {}),
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          e.target.style.backgroundColor = '#f0f0f0';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !active) {
          e.target.style.backgroundColor = 'white';
        }
      }}
    >
      {children}
    </button>
  );
}