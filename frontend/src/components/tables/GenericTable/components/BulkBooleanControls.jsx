import React, { useState } from 'react';
import axios from 'axios';

const BulkBooleanControls = ({ 
  columns, 
  colHeaders, 
  visibleColumns, 
  apiUrl, 
  quickSearch, 
  columnFilters, 
  serverPagination,
  onBulkUpdate 
}) => {
  const [showBulkDropdown, setShowBulkDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get boolean columns that are currently visible
  const getBooleanColumns = () => {
    return columns
      .map((col, index) => ({ ...col, index, header: colHeaders[index] }))
      .filter((col, index) => {
        // Only include visible boolean columns (checkbox type)
        return visibleColumns[index] !== false && 
               (col.type === 'checkbox' || 
                col.className === 'htCenter' ||
                ['create', 'delete', 'exists', 'include_in_zoning', 'logged_in'].includes(col.data));
      });
  };

  const booleanColumns = getBooleanColumns();

  // Handle bulk boolean update (local only)
  const handleBulkUpdate = (field, value) => {
    console.log(`🔥 Local bulk update: ${field} = ${value}`);
    
    // Notify parent component to apply local update
    if (onBulkUpdate) {
      onBulkUpdate({
        success: true,
        field: field,
        value: value,
        filteredCount: 0 // Will be calculated by GenericTable
      });
    }
    
    setShowBulkDropdown(false);
  };

  // Don't render if no boolean columns are visible
  if (booleanColumns.length === 0) {
    return null;
  }

  return (
    <div className="bulk-boolean-controls" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="modern-btn modern-btn-secondary"
        onClick={() => setShowBulkDropdown(!showBulkDropdown)}
        disabled={loading}
        title="Bulk update boolean fields across all pages"
        style={{
          fontSize: '12px',
          padding: '6px 10px',
          minWidth: '100px'
        }}
      >
        {loading ? (
          <>
            <div className="spinner" style={{ width: '12px', height: '12px', marginRight: '4px' }}></div>
            Updating...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,11 12,14 22,4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Bulk Check
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </>
        )}
      </button>

      {showBulkDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '4px',
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            zIndex: 10000,
            minWidth: '280px',
            maxHeight: '400px',
            overflow: 'auto'
          }}
        >
          <div style={{ 
            padding: '12px 16px 8px',
            borderBottom: '1px solid #e5e7eb'
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#374151',
              marginBottom: '4px'
            }}>
              Bulk Boolean Updates
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#6b7280',
              lineHeight: '1.4'
            }}>
              Apply to all records across all pages. Use Save to persist changes to database.
            </div>
          </div>

          {booleanColumns.map(col => (
            <div key={col.data} style={{ padding: '8px 0' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: '500', 
                color: '#374151', 
                padding: '4px 16px',
                marginBottom: '4px'
              }}>
                {col.header}
              </div>
              
              <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#059669',
                    transition: 'all 0.15s',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#ecfdf5';
                    e.target.style.borderColor = '#059669';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onClick={() => handleBulkUpdate(col.data, true)}
                  disabled={loading}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Check All
                </button>
                
                <button
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'none',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#dc2626',
                    transition: 'all 0.15s',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#fef2f2';
                    e.target.style.borderColor = '#dc2626';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.borderColor = '#d1d5db';
                  }}
                  onClick={() => handleBulkUpdate(col.data, false)}
                  disabled={loading}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Uncheck All
                </button>
              </div>
            </div>
          ))}
          
          <div style={{ 
            padding: '8px 16px',
            borderTop: '1px solid #e5e7eb',
            background: '#f9fafb',
            fontSize: '11px',
            color: '#6b7280',
            lineHeight: '1.4'
          }}>
            <strong>Note:</strong> Changes are applied locally and must be saved to persist to the database.
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showBulkDropdown && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }}
          onClick={() => setShowBulkDropdown(false)}
        />
      )}
    </div>
  );
};

export default BulkBooleanControls;