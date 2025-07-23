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
      
      console.log('Checking for running imports, found:', runningImport ? 'YES' : 'NO');
      if (response.data.length > 0) {
        console.log('Most recent import status:', response.data[0].status);
      }
      
      if (runningImport) {
        setCurrentImport(runningImport);
        setIsImportRunning(true);
        
        // If we have a task ID, start monitoring progress
        if (runningImport.celery_task_id) {
          startProgressMonitoring(runningImport.celery_task_id, runningImport.id);
        }
      } else {
        // No running imports found, clear running state
        console.log('No running imports found, clearing running state');
        setIsImportRunning(false);
        setImportProgress(null);
        
        // Update current import to the most recent one if we have one
        if (response.data.length > 0) {
          const mostRecentImport = response.data[0]; // History is sorted by most recent first
          setCurrentImport(mostRecentImport);
        }
      }
    } catch (error) {
      console.error('Error checking for running imports:', error);
    }
  };

  const startProgressMonitoring = (taskId, importId) => {
    let progressInterval;
    
    const pollProgress = async () => {
      try {
        // Check both task progress and import status
        const requests = [
          axios.get(`/api/importer/progress/${taskId}/`).catch(err => ({ error: err, type: 'progress' })),
          axios.get(`/api/importer/status/${importId}/`).catch(err => ({ error: err, type: 'status' }))
        ];
        
        const [progressResult, importResult] = await Promise.all(requests);
        
        // Handle import status (most important)
        let importStatus = null;
        if (!importResult.error) {
          importStatus = importResult.data;
          setCurrentImport(importStatus);
          
          // If import is no longer running in database, stop monitoring
          if (importStatus.status !== 'running') {
            console.log('Import no longer running in database, status:', importStatus.status);
            setIsImportRunning(false);
            setImportProgress(null);
            if (progressInterval) clearInterval(progressInterval);
            // Trigger a final refresh of import history to update UI
            setTimeout(() => checkForRunningImports(), 500);
            return;
          }
        }
        
        // Handle task progress
        if (!progressResult.error) {
          const progress = progressResult.data;
          
          // Update progress state and running status based on task state
          if (progress.state === 'PENDING') {
            // Task is still waiting, show generic importing status
            setImportProgress({
              state: 'PROGRESS',
              current: 0,
              total: 100,
              status: 'Import starting...'
            });
            setIsImportRunning(true);
          } else if (progress.state === 'PROGRESS') {
            // Task is actively running
            console.log('Task is in PROGRESS state, updating UI');
            setImportProgress(progress);
            setIsImportRunning(true);
          } else if (progress.state === 'SUCCESS') {
            // Task completed successfully - immediately clear running state
            console.log('Task completed successfully, clearing import status');
            setImportProgress({
              state: 'SUCCESS',
              current: 100,
              total: 100,
              status: 'Import completed successfully!'
            });
            
            // Immediately clear the running state
            setIsImportRunning(false);
            if (progressInterval) clearInterval(progressInterval);
            
            // Update the import status after a brief delay to catch database updates
            setTimeout(() => {
              checkForRunningImports();
              // Clear progress after showing completion message
              setTimeout(() => {
                setImportProgress(null);
              }, 3000); // Show success message for 3 seconds
            }, 1000);
          } else if (progress.state === 'FAILURE') {
            // Task failed
            setIsImportRunning(false);
            setImportProgress(null);
            if (progressInterval) clearInterval(progressInterval);
          }
        } else {
          // If we can't get task progress but import is still running, show generic status
          if (importStatus && importStatus.status === 'running') {
            setImportProgress({
              state: 'PROGRESS',
              current: 50,
              total: 100,
              status: 'Import is running...'
            });
            setIsImportRunning(true);
          }
        }
        
      } catch (err) {
        console.error('Unexpected error in pollProgress:', err);
        // Continue monitoring unless we're sure the import is done
      }
    };

    // Start polling immediately, then more frequently at first
    pollProgress();
    
    // Poll every 500ms for the first 10 seconds to catch rapid state changes
    let pollCount = 0;
    const maxFastPolls = 20; // 20 * 500ms = 10 seconds
    
    const startPolling = () => {
      progressInterval = setInterval(() => {
        pollProgress();
        pollCount++;
        
        // After 10 seconds, switch to slower polling
        if (pollCount >= maxFastPolls) {
          clearInterval(progressInterval);
          progressInterval = setInterval(pollProgress, 2000); // Slower polling
        }
      }, 500); // Fast initial polling
    };
    
    startPolling();

    // Stop polling after 15 minutes
    setTimeout(() => {
      if (progressInterval) {
        clearInterval(progressInterval);
        setIsImportRunning(false);
        setImportProgress(null);
      }
    }, 900000);
  };

  const startImport = (importData) => {
    
    // Immediately set the import as running with initial progress
    setCurrentImport(importData);
    setIsImportRunning(true);
    setImportProgress({
      state: 'INITIALIZING',
      current: 0,
      total: 100,
      status: 'Initializing import...'
    });
    
    if (importData.task_id && importData.import_id) {
      console.log('Starting progress monitoring for task:', importData.task_id, 'import:', importData.import_id);
      startProgressMonitoring(importData.task_id, importData.import_id);
    } else {
      console.error('Missing task_id or import_id in import data:', importData);
    }
  };

  const cancelImport = async (importId) => {
    try {
      const response = await axios.post(`/api/importer/cancel/${importId}/`);
      
      if (response.data.message) {
        // Update local state immediately
        setIsImportRunning(false);
        setImportProgress(null);
        
        // Get the updated import status
        try {
          const importResponse = await axios.get(`/api/importer/status/${importId}/`);
          setCurrentImport(importResponse.data);
        } catch (err) {
          // Fallback to local update
          setCurrentImport(prev => prev ? { 
            ...prev, 
            status: 'failed', 
            error_message: 'Import cancelled by user',
            completed_at: new Date().toISOString()
          } : null);
        }
        
        // Refresh the full import list
        await checkForRunningImports();
        
        return { success: true, message: response.data.message };
      }
    } catch (error) {
      console.error('Error cancelling import:', error);
      return { 
        success: false, 
        message: error.response?.data?.error || 'Failed to cancel import' 
      };
    }
  };

  const value = {
    isImportRunning,
    currentImport,
    importProgress,
    startImport,
    cancelImport,
    checkForRunningImports
  };

  return (
    <ImportStatusContext.Provider value={value}>
      {children}
    </ImportStatusContext.Provider>
  );
};