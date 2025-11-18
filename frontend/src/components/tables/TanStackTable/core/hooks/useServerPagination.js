import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../../../../../api';
import { generateServerFilters } from '../../utils/serverFilterUtils';

/**
 * Server-side pagination hook for TanStack Table
 * Migrated and enhanced from GenericTable/hooks/useServerPagination.js
 * Provides server-side data fetching, caching, and state management
 */
export function useServerPagination({
  apiUrl,
  initialPageSize = 50,
  storageKey,
  quickSearch = '',
  columnFilters = {},
  columns = [],
  onGlobalPageSizeChange,
  colHeaders = [],
  dropdownSources = {},
  visibleColumns = {},
  enabled = true,
}) {
  // State management
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  // Caching for performance
  const cacheRef = useRef(new Map());
  const abortControllerRef = useRef(null);

  // Computed values
  const totalPages = useMemo(() => {
    if (pageSize === "All") return 1;
    return Math.ceil(totalCount / pageSize);
  }, [totalCount, pageSize]);

  // Generate cache key for current state
  const generateCacheKey = useCallback((page, size, search, filters) => {
    const filterString = JSON.stringify(filters);
    return `${apiUrl}_${page}_${size}_${search}_${filterString}`;
  }, [apiUrl]);

  // Fetch data from server with caching
  const fetchData = useCallback(async (page, size, search = '', filters = {}, force = false) => {
    if (!apiUrl || !enabled) return;

    const cacheKey = generateCacheKey(page, size, search, filters);

    // Check cache first (unless force refresh)
    if (!force && cacheRef.current.has(cacheKey)) {
      const cachedData = cacheRef.current.get(cacheKey);
      setData(cachedData.results);
      setTotalCount(cachedData.count);
      return cachedData;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = {
        page,
        page_size: size === "All" ? "All" : size,
      };

      // Add search parameter
      if (search) {
        params.search = search;
      }

      // Add server-side filters
      if (Object.keys(filters).length > 0 && columns.length > 0) {
        const serverFilters = generateServerFilters(filters, columns, colHeaders, dropdownSources, visibleColumns);
        Object.assign(params, serverFilters);
      }

      console.log('🌐 Fetching server data:', { url: apiUrl, params });

      const response = await api.get(apiUrl, {
        params,
        signal: abortControllerRef.current.signal,
      });

      const responseData = response.data;
      const results = Array.isArray(responseData) ? responseData : responseData.results || [];
      const count = responseData.count || results.length;

      // Cache the results
      cacheRef.current.set(cacheKey, { results, count });

      // Limit cache size (LRU eviction)
      if (cacheRef.current.size > 50) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }

      setData(results);
      setTotalCount(count);

      console.log('✅ Server data loaded:', { count, results: results.length });

      return { results, count };

    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('🚫 Request aborted');
        return;
      }

      console.error('❌ Server pagination error:', err);
      setError(err.message || 'Failed to fetch data');
      setData([]);
      setTotalCount(0);

    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiUrl, enabled, generateCacheKey, columns, colHeaders, dropdownSources, visibleColumns]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  }, [totalPages]);

  const handlePageSizeChange = useCallback(async (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page

    // Update global settings if handler provided
    if (onGlobalPageSizeChange) {
      try {
        await onGlobalPageSizeChange(newPageSize);
      } catch (error) {
        console.error('Failed to update global page size:', error);
      }
    }

    // Save to localStorage if storage key provided
    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_pageSize`, newPageSize.toString());
      } catch (error) {
        console.warn('Failed to save page size to localStorage:', error);
      }
    }
  }, [onGlobalPageSizeChange, storageKey]);

  // Navigation methods
  const goToFirstPage = useCallback(() => handlePageChange(1), [handlePageChange]);
  const goToLastPage = useCallback(() => handlePageChange(totalPages), [handlePageChange, totalPages]);
  const goToNextPage = useCallback(() => handlePageChange(currentPage + 1), [handlePageChange, currentPage]);
  const goToPreviousPage = useCallback(() => handlePageChange(currentPage - 1), [handlePageChange, currentPage]);

  // Refresh methods
  const refresh = useCallback((force = true) => {
    return fetchData(currentPage, pageSize, quickSearch, columnFilters, force);
  }, [fetchData, currentPage, pageSize, quickSearch, columnFilters]);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    cacheRef.current.clear();
    setError(null);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  // Load initial data and handle state changes
  useEffect(() => {
    if (apiUrl && enabled) {
      fetchData(currentPage, pageSize, quickSearch, columnFilters);
    }
  }, [apiUrl, enabled, currentPage, pageSize, quickSearch, columnFilters, fetchData]);

  // Load saved page size from localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        const savedPageSize = localStorage.getItem(`${storageKey}_pageSize`);
        if (savedPageSize && savedPageSize !== initialPageSize.toString()) {
          setPageSize(savedPageSize === "All" ? "All" : parseInt(savedPageSize, 10));
        }
      } catch (error) {
        console.warn('Failed to load page size from localStorage:', error);
      }
    }
  }, [storageKey, initialPageSize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    const startItem = pageSize === "All" ? 1 : (currentPage - 1) * pageSize + 1;
    const endItem = pageSize === "All" ? totalCount : Math.min(currentPage * pageSize, totalCount);

    return {
      startItem,
      endItem,
      totalCount,
      currentPage,
      totalPages,
      pageSize,
      isFirstPage: currentPage === 1,
      isLastPage: currentPage === totalPages || totalPages <= 1,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
    };
  }, [currentPage, pageSize, totalCount, totalPages]);

  // TanStack Table compatible pagination state
  const paginationState = useMemo(() => ({
    pageIndex: currentPage - 1, // TanStack uses 0-based indexing
    pageSize: pageSize === "All" ? totalCount : pageSize,
  }), [currentPage, pageSize, totalCount]);

  const setPaginationState = useCallback(({ pageIndex, pageSize: newPageSize }) => {
    if (pageIndex !== undefined) {
      handlePageChange(pageIndex + 1); // Convert from 0-based to 1-based
    }
    if (newPageSize !== undefined && newPageSize !== pageSize) {
      handlePageSizeChange(newPageSize);
    }
  }, [handlePageChange, handlePageSizeChange, pageSize]);

  return {
    // Data
    data,
    loading,
    error,

    // Pagination state
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    paginationInfo,

    // TanStack Table compatibility
    paginationState,
    setPaginationState,

    // Actions
    handlePageChange,
    handlePageSizeChange,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,

    // Utilities
    refresh,
    resetPagination,
    clearCache,

    // Cache info (for debugging)
    getCacheSize: () => cacheRef.current.size,
    getCacheKeys: () => Array.from(cacheRef.current.keys()),
  };
}

/**
 * Hook for client-side pagination with TanStack Table
 * Used when server pagination is not needed
 */
export function useClientPagination({
  data = [],
  initialPageSize = 50,
  storageKey,
}) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalCount = data.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const paginatedData = useMemo(() => {
    if (pageSize === "All") return data;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);

    if (storageKey) {
      try {
        localStorage.setItem(`${storageKey}_pageSize`, newPageSize.toString());
      } catch (error) {
        console.warn('Failed to save page size to localStorage:', error);
      }
    }
  }, [storageKey]);

  // TanStack Table compatibility
  const paginationState = useMemo(() => ({
    pageIndex: currentPage - 1,
    pageSize: pageSize === "All" ? totalCount : pageSize,
  }), [currentPage, pageSize, totalCount]);

  const setPaginationState = useCallback(({ pageIndex, pageSize: newPageSize }) => {
    if (pageIndex !== undefined) {
      handlePageChange(pageIndex + 1);
    }
    if (newPageSize !== undefined && newPageSize !== pageSize) {
      handlePageSizeChange(newPageSize);
    }
  }, [handlePageChange, handlePageSizeChange, pageSize]);

  return {
    data: paginatedData,
    loading: false,
    error: null,

    currentPage,
    pageSize,
    totalCount,
    totalPages,

    paginationState,
    setPaginationState,

    handlePageChange,
    handlePageSizeChange,
  };
}