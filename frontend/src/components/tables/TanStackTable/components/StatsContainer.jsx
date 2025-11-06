import React from 'react';
import { useTheme } from '../../../../context/ThemeContext';

/**
 * StatsContainer for TanStackCRUDTable - Shows table statistics and status
 * Features:
 * - Total rows count
 * - Current page / total pages (for paginated data)
 * - Selected cells count
 * - Checkbox selected rows count (via _selected column)
 * - Filter status indicator
 * - Unsaved changes indicator
 */
const StatsContainer = ({
  totalItems = 0,
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  displayedRows = 0,
  selectedCellsCount = 0,
  checkboxSelectedCount = 0,
  hasActiveFilters = false,
  hasUnsavedChanges = false,
  globalFilter = '',
  isPaginated = false
}) => {
  const { theme } = useTheme();
  const showPagination = isPaginated && totalPages > 1;
  const isFiltered = hasActiveFilters || (globalFilter && globalFilter.trim().length > 0);

  return (
    <div className={`stats-container theme-${theme}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      fontSize: '12px',
      color: 'var(--table-toolbar-text)',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      backgroundColor: 'var(--table-toolbar-bg)'
    }}>
      {/* Total Items */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span style={{ color: 'var(--muted-text)' }}>Total:</span>
        <span style={{
          color: 'var(--link-text)',
          fontWeight: '600'
        }}>
          {totalItems.toLocaleString()}
        </span>
      </div>

      {/* Pagination Info */}
      {showPagination && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--table-border)'
          }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ color: 'var(--muted-text)' }}>Page:</span>
            <span style={{
              color: 'var(--link-text)',
              fontWeight: '600'
            }}>
              {currentPage} of {totalPages}
            </span>
          </div>
        </>
      )}

      {/* Checkbox Selected Rows (via _selected column) */}
      {checkboxSelectedCount > 0 && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--table-border)'
          }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--link-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span style={{ color: 'var(--muted-text)' }}>Selected:</span>
            <span style={{
              color: 'var(--link-text)',
              fontWeight: '600'
            }}>
              {checkboxSelectedCount.toLocaleString()}
            </span>
          </div>
        </>
      )}

      {/* Selected Cells (for cell selection) */}
      {selectedCellsCount > 0 && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--table-border)'
          }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ color: 'var(--muted-text)' }}>Cells:</span>
            <span style={{
              color: 'var(--link-text)',
              fontWeight: '600'
            }}>
              {selectedCellsCount}
            </span>
          </div>
        </>
      )}

      {/* Filter Status */}
      {isFiltered && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--table-border)'
          }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--success-color)'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <span>Filtered</span>
          </div>
        </>
      )}

      {/* Unsaved Changes */}
      {hasUnsavedChanges && (
        <>
          <div style={{
            width: '1px',
            height: '16px',
            backgroundColor: 'var(--table-border)'
          }}></div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--error-color)'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--error-color)'
            }}></div>
            <span>Unsaved</span>
          </div>
        </>
      )}
    </div>
  );
};

export default StatsContainer;