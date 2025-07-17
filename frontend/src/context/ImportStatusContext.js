import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const ImportStatusContext = createContext();

export const useImportStatus = () => {
  const context = useContext(ImportStatusContext);
  if (!context) {
    throw new Error('useImportStatus must be used within an ImportStatusProvider');
  }
  return context;
};

export const ImportStatusProvider = ({ children }) => {
  const [isImportRunning, setIsImportRunning] = useState(false);
  const [currentImport, setCurrentImport] = useState(null);
  const [importProgress, setImportProgress] = useState(null);

  // Check for running imports on mount
  useEffect(() => {
    checkForRunningImports();
  }, []);

  const checkForRunningImports = async () => {
    try {
      const response = await axios.get('/api/importer/history/');
      const runningImport = response.data.find(imp => imp.status === 'running');
      
      if (runningImport) {
        setCurrentImport(runningImport);
        setIsImportRunning(true);
        
        // If we have a task ID, start monitoring progress
        if (runningImport.celery_task_id) {
          startProgressMonitoring(runningImport.celery_task_id, runningImport.id);
        }
      }
    } catch (error) {
      console.error('Error checking for running imports:', error);
    }
  };

  const startProgressMonitoring = (taskId, importId) => {
    const pollProgress = async () => {
      try {
        const progressResponse = await axios.get(`/api/importer/progress/${taskId}/`);
        const progress = progressResponse.data;
        
        setImportProgress(progress);
        
        // If task is complete, stop monitoring
        if (progress.state === 'SUCCESS' || progress.state === 'FAILURE') {
          setIsImportRunning(false);
          setImportProgress(null);
          
          // Get final import details
          try {
            const importResponse = await axios.get(`/api/importer/status/${importId}/`);
            setCurrentImport(importResponse.data);
          } catch (err) {
            console.error('Error fetching final import status:', err);
          }
          
          clearInterval(progressInterval);
        }
      } catch (err) {
        console.error('Error polling import progress:', err);
        // Stop monitoring on error
        setIsImportRunning(false);
        setImportProgress(null);
        clearInterval(progressInterval);
      }
    };

    // Start polling immediately and then every 3 seconds
    pollProgress();
    const progressInterval = setInterval(pollProgress, 3000);

    // Stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(progressInterval);
      setIsImportRunning(false);
      setImportProgress(null);
    }, 900000);
  };

  const startImport = (importData) => {
    setCurrentImport(importData);
    setIsImportRunning(true);
    
    if (importData.task_id) {
      startProgressMonitoring(importData.task_id, importData.import_id);
    }
  };

  const value = {
    isImportRunning,
    currentImport,
    importProgress,
    startImport,
    checkForRunningImports
  };

  return (
    <ImportStatusContext.Provider value={value}>
      {children}
    </ImportStatusContext.Provider>
  );
};