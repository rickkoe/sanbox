import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';

const BulkBooleanModal = ({ 
  show, 
  onHide,
  columns, 
  colHeaders, 
  visibleColumns, 
  onBulkUpdate 
}) => {
  const [loading, setLoading] = useState(false);

  // Get boolean columns that are currently visible
  const getBooleanColumns = () => {
    return columns
      .map((col, index) => ({ ...col, index, header: colHeaders[index] }))
      .filter((col, index) => {
        // Only include visible boolean columns
        return visibleColumns[index] !== false && 
               (col.type === 'checkbox' || 
                ['create', 'delete', 'exists', 'include_in_zoning', 'logged_in'].includes(col.data));
      });
  };

  const booleanColumns = getBooleanColumns();

  // Handle bulk boolean update (local only)
  const handleBulkUpdate = (field, value) => {
    console.log(`🔥 Local bulk update: ${field} = ${value}`);
    
    setLoading(true);
    
    // Notify parent component to apply local update
    if (onBulkUpdate) {
      onBulkUpdate({
        success: true,
        field: field,
        value: value,
        filteredCount: 0 // Will be calculated by GenericTable
      });
    }
    
    // Close modal after a brief delay to show the action
    setTimeout(() => {
      setLoading(false);
      onHide();
    }, 500);
  };

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,11 12,14 22,4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Bulk Boolean Updates
          </div>
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {booleanColumns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 1rem' }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12l2 2 4-4"/>
            </svg>
            <p>No boolean columns are currently visible in this table.</p>
          </div>
        ) : (
          <>
            <div style={{ 
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#374151',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Quick Actions
              </div>
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                Apply boolean changes to all records across all pages. Changes are applied locally and must be saved to persist to the database.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {booleanColumns.map(col => (
                <div key={col.data} style={{
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#fff'
                }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#374151', 
                    marginBottom: '12px'
                  }}>
                    {col.header}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #22c55e',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#059669',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#22c55e';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#f0fdf4';
                        e.target.style.color = '#059669';
                      }}
                      onClick={() => handleBulkUpdate(col.data, true)}
                      disabled={loading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                      Check All
                    </button>
                    
                    <button
                      className="btn"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #ef4444',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#dc2626',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#ef4444';
                        e.target.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#fef2f2';
                        e.target.style.color = '#dc2626';
                      }}
                      onClick={() => handleBulkUpdate(col.data, false)}
                      disabled={loading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      Uncheck All
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <div style={{ 
          fontSize: '12px', 
          color: '#6b7280',
          lineHeight: '1.4',
          flex: 1,
          textAlign: 'left'
        }}>
          <strong>💡 Tip:</strong> Changes are applied locally. Use the Save button to persist changes to the database.
        </div>
        <button 
          className="btn btn-secondary"
          onClick={onHide}
          disabled={loading}
        >
          {loading ? 'Applying...' : 'Close'}
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default BulkBooleanModal;