import { useRef, useCallback, useEffect } from 'react';

// Custom hook to manage the ZoneTable web worker
export const useZoneTableWorker = () => {
  const workerRef = useRef(null);
  const pendingRequests = useRef(new Map());
  const requestIdCounter = useRef(0);

  // Initialize worker
  useEffect(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(process.env.PUBLIC_URL + '/zoneTableWorker.js');
      
      workerRef.current.onmessage = (e) => {
        const { type, result, error, requestId } = e.data;
        
        if (type === 'ERROR') {
          console.error('Worker error:', error);
          return;
        }
        
        const request = pendingRequests.current.get(requestId);
        if (request) {
          const { resolve, reject } = request;
          pendingRequests.current.delete(requestId);
          
          if (error) {
            reject(new Error(error));
          } else {
            resolve(result);
          }
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending requests
        pendingRequests.current.forEach(({ reject }) => {
          reject(new Error('Worker error'));
        });
        pendingRequests.current.clear();
      };
    }
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingRequests.current.clear();
    };
  }, []);

  // Generic method to send messages to worker
  const sendMessage = useCallback((type, data) => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not available'));
        return;
      }
      
      const requestId = ++requestIdCounter.current;
      pendingRequests.current.set(requestId, { resolve, reject });
      
      workerRef.current.postMessage({ type, data: { ...data, requestId } });
      
      // Set timeout to prevent hanging requests
      setTimeout(() => {
        if (pendingRequests.current.has(requestId)) {
          pendingRequests.current.delete(requestId);
          reject(new Error('Worker request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }, []);

  // Calculate used aliases across all table data
  const calculateUsedAliases = useCallback((sourceData, totalColumns) => {
    return sendMessage('CALCULATE_USED_ALIASES', { sourceData, totalColumns });
  }, [sendMessage]);

  // Filter aliases for a specific fabric
  const filterAliasesForFabric = useCallback((fabricAliases, usedAliases, currentValue, aliasMaxZones, rowFabric) => {
    return sendMessage('FILTER_ALIASES_FOR_FABRIC', {
      fabricAliases,
      usedAliases,
      currentValue,
      aliasMaxZones,
      rowFabric
    });
  }, [sendMessage]);

  // Calculate zone counts for aliases
  const calculateZoneCounts = useCallback((rawData, aliases) => {
    return sendMessage('CALCULATE_ZONE_COUNTS', { rawData, aliases });
  }, [sendMessage]);

  // Process raw aliases data
  const processAliasesData = useCallback((aliasesArray, fabricOptions) => {
    return sendMessage('PROCESS_ALIASES_DATA', { aliasesArray, fabricOptions });
  }, [sendMessage]);

  // Validate zone fabric status
  const validateZoneFabricStatus = useCallback((zones, memberOptions) => {
    return sendMessage('VALIDATE_ZONE_FABRIC_STATUS', { zones, memberOptions });
  }, [sendMessage]);

  return {
    calculateUsedAliases,
    filterAliasesForFabric,
    calculateZoneCounts,
    processAliasesData,
    validateZoneFabricStatus,
    isWorkerReady: !!workerRef.current
  };
};