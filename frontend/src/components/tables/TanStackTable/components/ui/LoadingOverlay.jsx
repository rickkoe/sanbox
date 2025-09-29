import React from 'react';

/**
 * Loading overlay component for TanStack Table
 * Shows loading state with optional progress information
 */
export function LoadingOverlay({
  isVisible = false,
  message = 'Loading...',
  showProgress = false,
  progressMessage = '',
  overlay = false,
  className = '',
  style = {},
}) {
  if (!isVisible) return null;

  const overlayClass = overlay ? 'loading-overlay overlay' : 'loading-overlay';

  return (
    <div
      className={`${overlayClass} ${className}`}
      style={{
        position: overlay ? 'absolute' : 'static',
        top: overlay ? 0 : 'auto',
        left: overlay ? 0 : 'auto',
        right: overlay ? 0 : 'auto',
        bottom: overlay ? 0 : 'auto',
        backgroundColor: overlay ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlay ? 1000 : 'auto',
        minHeight: overlay ? '100%' : '200px',
        ...style,
      }}
    >
      <div className="loading-content" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '24px',
        borderRadius: '8px',
        backgroundColor: 'white',
        boxShadow: overlay ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
        maxWidth: '300px',
        textAlign: 'center',
      }}>
        {/* Spinner */}
        <div
          className="loading-spinner"
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid #f0f0f0',
            borderTop: '3px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />

        {/* Main message */}
        <div
          className="loading-message"
          style={{
            fontSize: '16px',
            fontWeight: '500',
            color: '#333',
            margin: 0,
          }}
        >
          {message}
        </div>

        {/* Progress message */}
        {showProgress && progressMessage && (
          <div
            className="loading-progress"
            style={{
              fontSize: '14px',
              color: '#666',
              margin: 0,
              lineHeight: '1.4',
            }}
          >
            {progressMessage}
          </div>
        )}

        {/* Progress bar (optional) */}
        {showProgress && (
          <div
            className="loading-progress-bar"
            style={{
              width: '200px',
              height: '4px',
              backgroundColor: '#f0f0f0',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: '#3498db',
                borderRadius: '2px',
                animation: 'loading-bar 2s ease-in-out infinite',
                transformOrigin: 'left',
              }}
            />
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes loading-bar {
          0% {
            transform: scaleX(0);
          }
          50% {
            transform: scaleX(0.7);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Inline loading spinner for smaller spaces
 */
export function InlineSpinner({
  size = 16,
  color = '#3498db',
  className = '',
  style = {},
}) {
  return (
    <div
      className={`inline-spinner ${className}`}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid transparent`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        ...style,
      }}
    >
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Table row loading skeleton
 */
export function TableRowSkeleton({
  columns = 4,
  height = 40,
  className = '',
}) {
  return (
    <tr className={`table-row-skeleton ${className}`}>
      {Array.from({ length: columns }).map((_, index) => (
        <td
          key={index}
          style={{
            height: `${height}px`,
            padding: '8px 12px',
            borderBottom: '1px solid #e0e0e0',
          }}
        >
          <div
            style={{
              height: '16px',
              backgroundColor: '#f0f0f0',
              borderRadius: '4px',
              animation: 'skeleton-pulse 1.5s ease-in-out infinite',
            }}
          />
        </td>
      ))}

      <style>{`
        @keyframes skeleton-pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </tr>
  );
}

/**
 * Full table loading skeleton
 */
export function TableSkeleton({
  rows = 10,
  columns = 4,
  showHeader = true,
  className = '',
}) {
  return (
    <div className={`table-skeleton ${className}`} style={{ width: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {showHeader && (
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th
                  key={index}
                  style={{
                    height: '48px',
                    padding: '12px',
                    borderBottom: '2px solid #e0e0e0',
                    backgroundColor: '#f5f5f5',
                  }}
                >
                  <div
                    style={{
                      height: '16px',
                      backgroundColor: '#e0e0e0',
                      borderRadius: '4px',
                      animation: 'skeleton-pulse 1.5s ease-in-out infinite',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRowSkeleton
              key={rowIndex}
              columns={columns}
              height={40}
            />
          ))}
        </tbody>
      </table>

      <style>{`
        @keyframes skeleton-pulse {
          0% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}