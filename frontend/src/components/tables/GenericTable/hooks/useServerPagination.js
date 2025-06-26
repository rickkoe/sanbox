import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

export const useServerPagination = (baseApiUrl, defaultPageSize = 100, storageKey = null) => {
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Cache for storing loaded pages
  const [pageCache, setPageCache] = useState({});
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  
  // Debounce search
  const searchTimeoutRef = useRef(null);
  
  // Build API URL with parameters
  const buildApiUrl = useCallback((page, size, search = '') => {
    let url = `${baseApiUrl}?page=${page}&page_size=${size}`;
    if (search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
    return url;
  }, [baseApiUrl]);
  
  // Create cache key
  const getCacheKey = useCallback((page, size, search = '') => {
    return `${page}-${size}-${search}`;
  }, []);
  
  // Fetch data from server
  const fetchPage = useCallback(async (page, size, search = '', isBackground = false) => {
    const cacheKey = getCacheKey(page, size, search);
    
    // Check cache first
    if (pageCache[cacheKey] && !isBackground) {
      console.log(`📦 Using cached data for page ${page}`);
      return pageCache[cacheKey];
    }
    
    try {
      if (!isBackground) {
        setLoading(true);
        setError(null);
      } else {
        setBackgroundLoading(true);
      }
      
      console.log(`🌐 Fetching page ${page}, size ${size}, search: "${search}"`);
      const response = await axios.get(buildApiUrl(page, size, search));
      
      const result = {
        results: response.data.results,
        count: response.data.count,
        page: response.data.page,
        pageSize: response.data.page_size,
        totalPages: response.data.total_pages,
        hasNext: response.data.has_next,
        hasPrevious: response.data.has_previous
      };
      
      // Cache the result
      setPageCache(prev => ({
        ...prev,
        [cacheKey]: result
      }));
      
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
  }, [buildApiUrl, getCacheKey, pageCache]);
  
  // Background prefetch for next pages
  const prefetchNextPages = useCallback(async (currentPage, pageSize, searchTerm) => {
    if (pageSize === "All") return;
    
    try {
      // Prefetch next 2 pages in background
      for (let i = 1; i <= 2; i++) {
        const nextPage = currentPage + i;
        const cacheKey = getCacheKey(nextPage, pageSize, searchTerm);
        
        if (!pageCache[cacheKey] && nextPage <= totalPages) {
          console.log(`🔄 Background loading page ${nextPage}`);
          await fetchPage(nextPage, pageSize, searchTerm, true);
        }
      }
    } catch (error) {
      console.log('Background prefetch failed:', error);
    }
  }, [fetchPage, getCacheKey, pageCache, totalPages]);
  
  // Load current page data
  const loadData = useCallback(async () => {
    try {
      const result = await fetchPage(currentPage, pageSize, searchTerm);
      
      setData(result.results);
      setTotalCount(result.count);
      setTotalPages(result.totalPages);
      
      // Start background prefetch
      setTimeout(() => {
        prefetchNextPages(currentPage, pageSize, searchTerm);
      }, 100);
      
    } catch (error) {
      setData([]);
      setTotalCount(0);
      setTotalPages(1);
    }
  }, [currentPage, pageSize, searchTerm, fetchPage, prefetchNextPages]);
  
  // Debounced search
  const handleSearch = useCallback((newSearchTerm) => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(newSearchTerm);
      setCurrentPage(1); // Reset to first page
      setPageCache({}); // Clear cache when search changes
    }, 300); // 300ms debounce
  }, []);
  
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
  }, [storageKey]);
  
  // Reset to first page
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setPageCache({});
  }, []);
  
  // Load data when dependencies change
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
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
    
    // Search
    searchTerm,
    handleSearch,
    
    // Actions
    handlePageChange,
    handlePageSizeChange,
    resetPagination,
    refresh: loadData,
    
    // Cache info (for debugging)
    cacheSize: Object.keys(pageCache).length
  };
};