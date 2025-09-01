import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { generateServerFilters, createColumnMetadata } from '../utils/columnFilterUtils';

export const useServerPagination = (baseApiUrl, defaultPageSize = 100, storageKey = null, quickSearch = '', columnFilters = {}, columns = [], onPageSizeChange = null, colHeaders = [], dropdownSources = {}, visibleColumns = {}) => {
  // State management
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`${storageKey}_pageSize`);
      if (saved) {
        return saved === "All" ? "All" : parseInt(saved);
      }
    }
    return defaultPageSize;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // Cache for storing loaded pages
  const [pageCache, setPageCache] = useState({});
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [cacheInvalidated, setCacheInvalidated] = useState(false);
  
  // Build API URL with parameters including filters
  const buildApiUrl = useCallback((page, size, search = '', filters = {}) => {
    // Check if baseApiUrl already has query parameters
    const separator = baseApiUrl.includes('?') ? '&' : '?';
    // Handle "All" page size by using a very large number that the backend can handle
    const pageSize = size === "All" ? 10000 : size;
    let url = `${baseApiUrl}${separator}page=${page}&page_size=${pageSize}`;
    
    // Add search parameter
    if (search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    
    // Generate server-side filters using enhanced utilities
    if (Object.keys(filters).length > 0) {
      // Create column metadata for filter generation
      const columnMetadata = createColumnMetadata(columns, colHeaders, [], dropdownSources, visibleColumns);
      const serverFilters = generateServerFilters(filters, columnMetadata);
      
      // Add server filters to URL
      Object.entries(serverFilters).forEach(([param, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            // Handle array values (like __in filters)
            if (value.length > 0) {
              url += `&${param}=${value.map(v => encodeURIComponent(v)).join(',')}`;
            }
          } else {
            url += `&${param}=${encodeURIComponent(value)}`;
          }
        }
      });
      
      console.log('🔗 Generated server filters:', serverFilters);
    }
    
    console.log(`🌐 Final API URL: ${url}`);
    return url;
  }, [baseApiUrl, columns, colHeaders, dropdownSources, visibleColumns]);
  
  // Create cache key including filters
  const getCacheKey = useCallback((page, size, search = '', filters = {}) => {
    const filtersKey = JSON.stringify(filters);
    return `${page}-${size}-${search}-${filtersKey}`;
  }, []);
  
  // Fetch data from server
  const fetchPage = useCallback(async (page, size, search = '', filters = {}, isBackground = false) => {
    const cacheKey = getCacheKey(page, size, search, filters);
    
    // Check cache first - but skip cache if filters changed or cache was invalidated
    if (pageCache[cacheKey] && !isBackground && !cacheInvalidated) {
      return pageCache[cacheKey];
    }
    
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      } else {
        setBackgroundLoading(true);
      }
      
      const apiUrl = buildApiUrl(page, size, search, filters);
      const response = await axios.get(apiUrl);
      
      
      const result = {
        results: response.data.results,
        count: response.data.count,
        page: response.data.current_page || response.data.page,
        pageSize: response.data.page_size,
        totalPages: response.data.num_pages || response.data.total_pages,
        hasNext: response.data.has_next,
        hasPrevious: response.data.has_previous
      };
      
      // Cache the result and clear invalidation flag
      setPageCache(prev => ({
        ...prev,
        [cacheKey]: result
      }));
      setCacheInvalidated(false);
      
      return result;
      
    } catch (err) {
      console.error('Error fetching data:', err);
      if (!isBackground) {
        setError(err.message);
      }
      throw err;
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setBackgroundLoading(false);
      }
    }
  }, [buildApiUrl, getCacheKey, pageCache, cacheInvalidated]);
  
  // Background prefetch for next pages
  const prefetchNextPages = useCallback(async (currentPage, pageSize, searchTerm, filters) => {
    if (pageSize === "All") return;
    
    try {
      // Prefetch next 2 pages in background
      for (let i = 1; i <= 2; i++) {
        const nextPage = currentPage + i;
        const cacheKey = getCacheKey(nextPage, pageSize, searchTerm, filters);
        
        if (!pageCache[cacheKey] && nextPage <= totalPages) {
          console.log(`🔄 Background loading page ${nextPage}`);
          await fetchPage(nextPage, pageSize, searchTerm, filters, true);
        }
      }
    } catch (error) {
      console.log('Background prefetch failed:', error);
    }
  }, [fetchPage, getCacheKey, pageCache, totalPages]);
  
  // Load current page data
  const loadData = useCallback(async () => {
    try {
      const result = await fetchPage(currentPage, pageSize, quickSearch, columnFilters);
      
      setData(result.results);
      setTotalCount(result.count);
      setTotalPages(result.totalPages);
      
      
      // Start background prefetch
      setTimeout(() => {
        prefetchNextPages(currentPage, pageSize, quickSearch, columnFilters);
      }, 100);
      
    } catch (error) {
      setData([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  }, [currentPage, pageSize, quickSearch, columnFilters, fetchPage, prefetchNextPages]);
  
  // Clear cache when search or filters change
  useEffect(() => {
    setCurrentPage(1); // Reset to first page
    setPageCache({}); // Clear cache when search/filters change
    setCacheInvalidated(true); // Mark cache as invalidated to force fresh fetch
  }, [quickSearch, columnFilters]);
  
  // Handle page changes
  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);
  
  // Handle page size changes
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    setPageCache({}); // Clear cache when page size changes
    
    // Save to localStorage
    if (storageKey) {
      localStorage.setItem(`${storageKey}_pageSize`, newPageSize);
    }
    
    // Update global settings if callback provided
    if (onPageSizeChange && typeof onPageSizeChange === 'function') {
      onPageSizeChange(newPageSize);
    }
  }, [storageKey, onPageSizeChange]);
  
  // Reset to first page
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setPageCache({});
  }, []);
  
  // Load data when dependencies change
  useEffect(() => {
    if (baseApiUrl) {
      loadData();
    }
  }, [loadData, baseApiUrl]);
  
  
  return {
    // Data
    data,
    loading,
    error,
    backgroundLoading,
    
    // Pagination
    currentPage,
    pageSize,
    totalCount,
    totalPages,
    
    
    // Actions
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    refresh: loadData,
    
    // Cache info (for debugging)
    cacheSize: Object.keys(pageCache).length
  };
};