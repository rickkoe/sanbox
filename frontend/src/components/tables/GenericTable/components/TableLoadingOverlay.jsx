import React from 'react';
import './TableLoadingOverlay.css';

const TableLoadingOverlay = ({ 
  isVisible, 
  message = "Loading table data...",
  showProgress = false,
  progressMessage = ""
}) => {
  if (!isVisible) return null;

  return (
    <div className="table-loading-overlay">
      <div className="loading-content">
        {/* Animated spinner */}
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        
        {/* Loading message */}
        <div className="loading-message">
          <h3>{message}</h3>
          {showProgress && progressMessage && (
            <p className="progress-message">{progressMessage}</p>
          )}
        </div>
        
        {/* Optional skeleton table preview */}
        <div className="skeleton-table">
          <div className="skeleton-row skeleton-header">
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
            <div className="skeleton-cell"></div>
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TableLoadingOverlay;