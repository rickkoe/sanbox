import React, { useState } from 'react';
import ExportDropdown from './ExportDropdown';
import ColumnsDropdown from './ColumnsDropdown';
import QuickSearch from './QuickSearch';
import StatsContainer from './StatsContainer';

const TableHeader = ({
  loading,
  isDirty,
  onSave,
  onExportCSV,
  onExportExcel,
  columns,
  colHeaders,
  visibleColumns,
  columnFilter,
  setColumnFilter,
  toggleColumnVisibility,
  toggleAllColumns,
  isRequiredColumn,
  quickSearch,
  setQuickSearch,
  unsavedData,
  hasNonEmptyValues,
  selectedCount,
  showCustomFilter,
  setShowCustomFilter,
  additionalButtons
}) => {
  return (
    <div className="modern-table-header">
      <div className="header-left">
        <div className="action-group">
          <button 
            className={`modern-btn modern-btn-primary ${loading ? 'loading' : ''} ${!isDirty ? 'disabled' : ''}`}
            onClick={onSave} 
            disabled={loading || !isDirty}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
                Save Changes
              </>
            )}
          </button>
          
          <ExportDropdown 
            onExportCSV={onExportCSV}
            onExportExcel={onExportExcel}
          />

          <ColumnsDropdown
            columns={columns}
            colHeaders={colHeaders}
            visibleColumns={visibleColumns}
            columnFilter={columnFilter}
            setColumnFilter={setColumnFilter}
            toggleColumnVisibility={toggleColumnVisibility}
            toggleAllColumns={toggleAllColumns}
            isRequiredColumn={isRequiredColumn}
          />

          {additionalButtons && (
            <div className="additional-buttons">
              <button 
                className={`modern-btn modern-btn-secondary ${showCustomFilter ? 'active' : ''}`}
                onClick={() => setShowCustomFilter(!showCustomFilter)}
                title="Toggle Filters"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                </svg>
                {showCustomFilter ? 'Hide Filters' : 'Show Filters'}
              </button>
              {additionalButtons}
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        <QuickSearch 
          quickSearch={quickSearch}
          setQuickSearch={setQuickSearch}
        />
        
        <StatsContainer
          unsavedData={unsavedData}
          hasNonEmptyValues={hasNonEmptyValues}
          selectedCount={selectedCount}
          quickSearch={quickSearch}
          isDirty={isDirty}
        />
      </div>
    </div>
  );
};

export default TableHeader;