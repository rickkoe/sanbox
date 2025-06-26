import { useState, useEffect } from 'react';
import axios from 'axios';

export const useTableData = (apiUrl, newRowTemplate, preprocessData, columns) => {
  const [data, setData] = useState([]);
  const [unsavedData, setUnsavedData] = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const ensureBlankRow = (rows) => {
    if (!Array.isArray(rows)) return [{ ...newRowTemplate }];
    
    if (rows.length === 0 || hasNonEmptyValues(rows[rows.length - 1])) {
      return [...rows, { ...newRowTemplate }];
    }
    return rows;
  };

  const hasNonEmptyValues = (row) => {
    if (!row) return false;
    
    return Object.keys(row).some(key => {
      if (key === 'id' || key === 'saved') return false;
      
      const value = row[key];
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim() !== '';
      if (typeof value === 'boolean') return value === true;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    });
  };

  const performQuickSearch = (data, searchTerm) => {
    if (!searchTerm.trim()) {
      return data;
    }
    
    const searchTermLower = searchTerm.toLowerCase();
    
    return data.filter(row => {
      return columns.some(col => {
        const value = row[col.data];
        if (value === null || value === undefined) return false;
        
        // Handle nested object values (like fabric_details.name)
        if (col.data.includes('.')) {
          const keys = col.data.split('.');
          let nestedValue = row;
          for (const key of keys) {
            nestedValue = nestedValue?.[key];
            if (nestedValue === null || nestedValue === undefined) break;
          }
          if (nestedValue !== null && nestedValue !== undefined) {
            return String(nestedValue).toLowerCase().includes(searchTermLower);
          }
          return false;
        }
        
        // Convert value to string and search
        return String(value).toLowerCase().includes(searchTermLower);
      });
    });
  };

  const fetchData = async () => {
    try {
      console.log("Fetching data from:", apiUrl);
      const response = await axios.get(apiUrl);
      console.log("API Response:", response.data);
      
      let responseData = response.data;
      
      if (preprocessData && typeof preprocessData === 'function') {
        responseData = preprocessData(responseData);
        console.log("Preprocessed data:", responseData);
      }
      
      setData(responseData);
      setOriginalData(responseData);
      const dataWithBlankRow = ensureBlankRow(responseData);
      console.log("Final data with blank row:", dataWithBlankRow);
      setUnsavedData(dataWithBlankRow);
      setIsDirty(false);
    } catch (error) {
      console.error("Fetch error:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: apiUrl
      });
      
      // Set empty data so table can still render
      const emptyData = ensureBlankRow([]);
      setData([]);
      setOriginalData([]);
      setUnsavedData(emptyData);
      setIsDirty(false);
    }
  };

  // Remove automatic fetching - let the main component control this
  // useEffect(() => {
  //   if (apiUrl) {
  //     fetchData();
  //   }
  // }, [apiUrl]);

  return {
    data,
    unsavedData,
    setUnsavedData,
    originalData,
    isDirty,
    setIsDirty,
    quickSearch,
    setQuickSearch,
    fetchData,
    ensureBlankRow,
    hasNonEmptyValues,
    performQuickSearch
  };
};