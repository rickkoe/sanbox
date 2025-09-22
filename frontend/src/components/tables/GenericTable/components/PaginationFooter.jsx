import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PaginationFooter = ({ 
  currentPage, 
  totalPages, 
  pageSize, 
  totalItems, 
  onPageChange, 
  onPageSizeChange,
  loading = false 
}) => {
  const actualPageSize = pageSize === 'All' ? totalItems : pageSize;
  const startItem = ((currentPage - 1) * actualPageSize) + 1;
  const endItem = Math.min(currentPage * actualPageSize, totalItems);

  const handlePageSizeChange = (e) => {
    const newSize = e.target.value === 'all' ? 'All' : parseInt(e.target.value);
    onPageSizeChange(newSize);
  };

  const renderPageButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust startPage if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add ellipsis at the beginning if needed
    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          onClick={() => onPageChange(1)}
          className="pagination-btn"
          disabled={loading}
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis-start" className="pagination-ellipsis">
            ...
          </span>
        );
      }
    }

    // Add page buttons
    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => onPageChange(i)}
          className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
          disabled={loading}
        >
          {i}
        </button>
      );
    }

    // Add ellipsis at the end if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis-end" className="pagination-ellipsis">
            ...
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          onClick={() => onPageChange(totalPages)}
          className="pagination-btn"
          disabled={loading}
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  };

  // Always show footer for server pagination - users need access to page size controls
  // Only hide the navigation buttons when there's just one page

  return (
    <div className="table-pagination-footer">
      <div className="pagination-info">
        <div className="pagination-stats">
          <span className="pagination-text">
            Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of {totalItems.toLocaleString()} entries
          </span>
        </div>
        
        <div className="page-size-selector">
          <label className="page-size-label">Rows per page:</label>
          <select
            className="page-size-select"
            value={pageSize === 'All' || pageSize >= totalItems ? 'all' : pageSize}
            onChange={handlePageSizeChange}
            disabled={loading}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value="all">All ({totalItems.toLocaleString()})</option>
          </select>
        </div>
      </div>

      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || loading}
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="pagination-pages">
          {renderPageButtons()}
        </div>

        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
        
        <button
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || loading}
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default PaginationFooter;