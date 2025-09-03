import { useState, useMemo } from 'react';

export const usePagination = (data, defaultPageSize = 'All', storageKey = null, onPageSizeChange = null) => {
  // Initialize page size from localStorage if provided
  const getInitialPageSize = () => {
    if (storageKey) {
      const saved = localStorage.getItem(`${storageKey}_pageSize`);
      if (saved) {
        return saved === "All" ? "All" : parseInt(saved);
      }
    }
    return defaultPageSize;
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(getInitialPageSize);

  // Calculate pagination values
  const paginationData = useMemo(() => {
    const totalRows = data.length;
    
    if (pageSize === "All") {
      return {
        paginatedData: data,
        currentPage: 1,
        totalPages: 1,
        totalRows,
        startRow: 1,
        endRow: totalRows
      };
    }

    const totalPages = Math.ceil(totalRows / pageSize);
    const validCurrentPage = Math.min(currentPage, totalPages || 1);
    
    const startIndex = (validCurrentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = data.slice(startIndex, endIndex);

    return {
      paginatedData,
      currentPage: validCurrentPage,
      totalPages,
      totalRows,
      startRow: totalRows === 0 ? 0 : startIndex + 1,
      endRow: Math.min(endIndex, totalRows)
    };
  }, [data, currentPage, pageSize]);

  // Handle page changes
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Handle page size changes
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
    
    // Save to localStorage if storage key provided
    if (storageKey) {
      localStorage.setItem(`${storageKey}_pageSize`, newPageSize);
    }
    
    // Update global settings if callback provided
    if (onPageSizeChange && typeof onPageSizeChange === 'function') {
      onPageSizeChange(newPageSize);
    }
  };

  // Reset pagination when data changes significantly
  const resetPagination = () => {
    setCurrentPage(1);
  };

  return {
    ...paginationData,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  };
};