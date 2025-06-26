import React, { useState } from 'react';

const ExportDropdown = ({ onExportCSV, onExportExcel }) => {
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  return (
    <div className="export-dropdown" style={{ position: 'relative' }}>
      <button 
        className="modern-btn modern-btn-secondary dropdown-toggle"
        onClick={() => setShowExportDropdown(!showExportDropdown)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setTimeout(() => setShowExportDropdown(false), 150);
          }
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </button>
      
      <div 
        className={`dropdown-menu ${showExportDropdown ? 'show' : ''}`}
        style={{
          opacity: showExportDropdown ? 1 : 0,
          visibility: showExportDropdown ? 'visible' : 'hidden',
          transform: showExportDropdown ? 'translateY(0)' : 'translateY(-10px)'
        }}
      >
        <button 
          onClick={() => {
            onExportCSV();
            setShowExportDropdown(false);
          }} 
          className="dropdown-item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          Export as CSV
        </button>
        <button 
          onClick={() => {
            onExportExcel();
            setShowExportDropdown(false);
          }} 
          className="dropdown-item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
          </svg>
          Export as Excel
        </button>
      </div>
    </div>
  );
};

export default ExportDropdown;