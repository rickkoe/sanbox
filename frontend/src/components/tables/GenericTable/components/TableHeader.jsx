import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import AdvancedFilter from './AdvancedFilter';
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
  additionalButtons,
  headerButtons,
  pagination = null,
  data = [],
  onFilterChange,
  columnFilters = {},
  onClearAllFilters,
  apiUrl = null,  // Add apiUrl prop
  serverPagination = false  // Add serverPagination prop
}) => {
  const [showDataDropdown, setShowDataDropdown] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [dataDropdownPosition, setDataDropdownPosition] = useState({ top: 0, left: 0 });
  const [viewDropdownPosition, setViewDropdownPosition] = useState({ top: 0, left: 0 });
  const dataDropdownRef = useRef(null);
  const viewDropdownRef = useRef(null);
  const dataButtonRef = useRef(null);
  const viewButtonRef = useRef(null);

  // Calculate dropdown position with smart positioning
  const calculatePosition = (buttonRef, isViewDropdown = false) => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Dropdown dimensions
    const dropdownWidth = isViewDropdown ? 300 : 240;
    const dropdownHeight = isViewDropdown ? 400 : 250;
    
    let left = rect.left;
    let top = rect.bottom + 8;
    
    // Check if dropdown goes off right edge
    if (left + dropdownWidth > viewportWidth - 20) {
      left = rect.right - dropdownWidth;
    }
    
    // Check if dropdown goes off bottom edge
    if (top + dropdownHeight > viewportHeight - 20) {
      top = rect.top - dropdownHeight - 8;
    }
    
    // Ensure minimum margins
    left = Math.max(10, Math.min(left, viewportWidth - dropdownWidth - 10));
    top = Math.max(10, top);
    
    return { top, left };
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dataDropdownRef.current && !dataDropdownRef.current.contains(event.target) && 
          dataButtonRef.current && !dataButtonRef.current.contains(event.target)) {
        setShowDataDropdown(false);
      }
      if (viewDropdownRef.current && !viewDropdownRef.current.contains(event.target) && 
          viewButtonRef.current && !viewButtonRef.current.contains(event.target)) {
        setShowViewDropdown(false);
      }
    };

    if (showDataDropdown || showViewDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDataDropdown, showViewDropdown]);

  // Handle both old button format and new action object format
  const processAdditionalButtons = () => {
    if (!additionalButtons) return [];
    
    // If it's an array of action objects (new format)
    if (Array.isArray(additionalButtons)) {
      return additionalButtons.map((action, index) => ({
        key: index,
        text: action.text || 'Action',
        icon: action.icon || (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
        ),
        onClick: action.onClick
      }));
    }
    
    // If it's React children (old button format) - for backward compatibility
    const additionalButtonsArray = React.Children.toArray(additionalButtons);
    return additionalButtonsArray.map((button, index) => {
      const originalOnClick = button.props.onClick;
      
      // Extract button text - handle complex nested structures
      let buttonText = 'Action';
      
      // Function to recursively find text content
      const extractText = (children) => {
        if (typeof children === 'string') {
          return children;
        }
        if (Array.isArray(children)) {
          for (const child of children) {
            const text = extractText(child);
            if (text && text !== '') return text;
          }
        }
        if (React.isValidElement(children) && children.props && children.props.children) {
          return extractText(children.props.children);
        }
        return '';
      };
      
      const extractedText = extractText(button.props.children);
      if (extractedText && extractedText.trim() !== '') {
        buttonText = extractedText.trim();
      }
      
      // Extract icon from original button children
      let icon = null;
      const findIcon = (children) => {
        if (React.isValidElement(children) && children.type === 'svg') {
          return children;
        }
        if (Array.isArray(children)) {
          for (const child of children) {
            const foundIcon = findIcon(child);
            if (foundIcon) return foundIcon;
          }
        }
        if (React.isValidElement(children) && children.props && children.props.children) {
          return findIcon(children.props.children);
        }
        return null;
      };
      
      icon = findIcon(button.props.children) || (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
      );
      
      return {
        key: index,
        text: buttonText,
        icon: icon,
        onClick: originalOnClick
      };
    });
  };

  const processedActions = processAdditionalButtons();

  return (
    <>
      <div className="modern-table-header">
        <div className="header-left">
          <div className="action-group">
            {/* Save Button - Always Prominent */}
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

            {/* Data Actions Dropdown */}
            <div className="dropdown-container">
              <button 
                ref={dataButtonRef}
                className="modern-btn modern-btn-secondary dropdown-trigger"
                onClick={() => {
                  if (!showDataDropdown) {
                    setDataDropdownPosition(calculatePosition(dataButtonRef, false));
                  }
                  setShowDataDropdown(!showDataDropdown);
                  setShowViewDropdown(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
                Actions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dropdown-arrow">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
            </div>

            {/* View Controls Dropdown */}
            <div className="dropdown-container">
              <button 
                ref={viewButtonRef}
                className="modern-btn modern-btn-secondary dropdown-trigger"
                onClick={() => {
                  if (!showViewDropdown) {
                    setViewDropdownPosition(calculatePosition(viewButtonRef, true));
                  }
                  setShowViewDropdown(!showViewDropdown);
                  setShowDataDropdown(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
                Columns
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dropdown-arrow">
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </button>
            </div>
          </div>
          
        </div>

        <div className="header-right">
          <AdvancedFilter
            columns={columns}
            colHeaders={colHeaders}
            visibleColumns={visibleColumns}
            quickSearch={quickSearch}
            setQuickSearch={setQuickSearch}
            onFilterChange={onFilterChange}
            data={data}
            initialFilters={columnFilters}
            apiUrl={apiUrl}
            serverPagination={serverPagination}
          />
          
          {/* Header Buttons */}
          {headerButtons && (
            <div className="additional-buttons">
              {headerButtons}
            </div>
          )}
          
          <StatsContainer
            unsavedData={unsavedData}
            hasNonEmptyValues={hasNonEmptyValues}
            selectedCount={selectedCount}
            quickSearch={quickSearch}
            isDirty={isDirty}
            pagination={pagination}
          />
        </div>
      </div>

      {/* Portal-rendered Data dropdown */}
      {showDataDropdown && createPortal(
        <div 
          ref={dataDropdownRef}
          style={{
            position: 'fixed',
            top: dataDropdownPosition.top,
            left: dataDropdownPosition.left,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            zIndex: 99999,
            width: '240px',
            maxHeight: '60vh',
            overflow: 'hidden'
          }}
        >
          {/* Export Section */}
          <div style={{ padding: '8px 0' }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#6b7280', 
              padding: '8px 16px 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Export
            </div>
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              onClick={() => {
                onExportCSV();
                setShowDataDropdown(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Export as CSV
            </button>
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              onClick={() => {
                onExportExcel();
                setShowDataDropdown(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
              </svg>
              Export as Excel
            </button>
          </div>
          
          {/* Actions Section */}
          {processedActions.length > 0 && (
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 0' }}>
              <div style={{ 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#6b7280', 
                padding: '8px 16px 4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Actions
              </div>
              {processedActions.map((action) => (
                <button
                  key={action.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 16px',
                    background: 'none',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: '#374151',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  onClick={() => {
                    if (action.onClick) action.onClick();
                    setShowDataDropdown(false);
                  }}
                >
                  {action.icon}
                  {action.text}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Portal-rendered View dropdown */}
      {showViewDropdown && createPortal(
        <div 
          ref={viewDropdownRef}
          style={{
            position: 'fixed',
            top: viewDropdownPosition.top,
            left: viewDropdownPosition.left,
            background: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
            zIndex: 99999,
            width: '300px',
            maxHeight: '70vh',
            overflow: 'hidden'
          }}
        >
          {/* Columns Section */}
          <div style={{ borderTop: '1px solid #e5e7eb', padding: '8px 0' }}>
            <div style={{ 
              fontSize: '12px', 
              fontWeight: '600', 
              color: '#6b7280', 
              padding: '8px 16px 4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Columns
            </div>
            
            {/* Column Filter Input */}
            <div style={{ padding: '8px 16px' }}>
              <input
                type="text"
                placeholder="Filter columns..."
                value={columnFilter}
                onChange={(e) => setColumnFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#f9fafb'
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            
            {/* Toggle All Button */}
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f9fafb'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              onClick={() => {
                const allVisible = Object.values(visibleColumns).every(visible => visible);
                toggleAllColumns(!allVisible);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9,11 12,14 22,4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              Toggle All Columns
            </button>
            
            {/* Divider */}
            <div style={{ height: '1px', background: '#e5e7eb', margin: '8px 0' }}></div>
            
            {/* Column List */}
            <div style={{ 
              maxHeight: '300px', 
              overflow: 'auto',
              padding: '0 8px'
            }}>
              {colHeaders
                .map((header, originalIndex) => ({ header, originalIndex }))
                .filter(({ header }) => 
                  !columnFilter || header.toLowerCase().includes(columnFilter.toLowerCase())
                )
                .map(({ header, originalIndex }) => {
                  const isVisible = visibleColumns[originalIndex];
                  const isRequired = isRequiredColumn && isRequiredColumn(originalIndex);
                  
                  return (
                    <label 
                      key={originalIndex} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        margin: '2px 0',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => toggleColumnVisibility(originalIndex)}
                        disabled={isRequired}
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          margin: 0, 
                          cursor: 'pointer',
                          width: '16px',
                          height: '16px'
                        }}
                      />
                      <span style={{
                        fontSize: '13px',
                        color: isRequired ? '#6b7280' : '#374151',
                        fontStyle: isRequired ? 'italic' : 'normal',
                        userSelect: 'none',
                        lineHeight: '1.4',
                        wordBreak: 'break-word'
                      }}>
                        {header}
                        {isRequired && <span style={{ color: '#ef4444', marginLeft: '4px' }}>*</span>}
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default TableHeader;