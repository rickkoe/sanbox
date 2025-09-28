import React from 'react';

/**
 * Status formatter with icons and colors
 */
export const StatusFormatter = ({ row, column }) => {
  const value = row[column.key];
  
  switch (value?.toLowerCase()) {
    case 'valid':
    case 'active':
    case 'online':
    case 'connected':
      return (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#28a745', fontSize: '16px' }}>✅</span>
        </div>
      );
      
    case 'invalid':
    case 'inactive':
    case 'offline':
    case 'disconnected':
    case 'error':
      return (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#dc3545', fontSize: '16px' }}>❌</span>
        </div>
      );
      
    case 'warning':
    case 'degraded':
      return (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#ffc107', fontSize: '16px' }}>⚠️</span>
        </div>
      );
      
    case 'pending':
    case 'processing':
      return (
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: '#17a2b8', fontSize: '16px' }}>🔄</span>
        </div>
      );
      
    default:
      return <div style={{ textAlign: 'center' }}>{value || ''}</div>;
  }
};

/**
 * Boolean formatter with checkmarks
 */
export const BooleanFormatter = ({ row, column }) => {
  const value = Boolean(row[column.key]);
  
  return (
    <div style={{ textAlign: 'center' }}>
      {value ? (
        <span style={{ color: '#28a745', fontSize: '16px' }}>✓</span>
      ) : (
        <span style={{ color: '#6c757d', fontSize: '12px' }}>○</span>
      )}
    </div>
  );
};

/**
 * Number formatter with proper alignment and formatting
 */
export const NumberFormatter = ({ 
  row, 
  column, 
  decimals = 0, 
  prefix = '', 
  suffix = '',
  thousandsSeparator = ',' 
}) => {
  const value = row[column.key];
  
  if (value === null || value === undefined || value === '') {
    return <div style={{ textAlign: 'right' }}>-</div>;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return <div style={{ textAlign: 'right' }}>{value}</div>;
  }
  
  const formatted = numValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  return (
    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
      {prefix}{formatted}{suffix}
    </div>
  );
};

/**
 * Percentage formatter
 */
export const PercentageFormatter = ({ row, column, decimals = 1 }) => {
  const value = row[column.key];
  
  if (value === null || value === undefined || value === '') {
    return <div style={{ textAlign: 'right' }}>-</div>;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return <div style={{ textAlign: 'right' }}>{value}</div>;
  }
  
  const percentage = numValue.toFixed(decimals);
  const color = numValue > 90 ? '#dc3545' : numValue > 75 ? '#ffc107' : '#28a745';
  
  return (
    <div style={{ textAlign: 'right', fontFamily: 'monospace', color }}>
      {percentage}%
    </div>
  );
};

/**
 * Date formatter
 */
export const DateFormatter = ({ row, column, format = 'short' }) => {
  const value = row[column.key];
  
  if (!value) return <div>-</div>;
  
  const date = value instanceof Date ? value : new Date(value);
  
  if (isNaN(date.getTime())) {
    return <div>{value}</div>;
  }
  
  const options = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    },
    time: { hour: '2-digit', minute: '2-digit' }
  };
  
  return (
    <div style={{ fontSize: '0.9em' }}>
      {date.toLocaleDateString('en-US', options[format] || options.short)}
    </div>
  );
};

/**
 * WWPN formatter with proper spacing
 */
export const WWPNFormatter = ({ row, column }) => {
  const value = row[column.key];
  
  if (!value) return <div>-</div>;
  
  // Format WWPN with colons if not already formatted
  const formatted = value.includes(':') 
    ? value 
    : value.replace(/(.{2})/g, '$1:').replace(/:$/, '');
  
  return (
    <div style={{ 
      fontFamily: 'monospace', 
      fontSize: '0.9em',
      letterSpacing: '0.5px'
    }}>
      {formatted}
    </div>
  );
};

/**
 * Capacity formatter for storage sizes
 */
export const CapacityFormatter = ({ row, column, unit = 'auto' }) => {
  const value = row[column.key];
  
  if (value === null || value === undefined || value === '') {
    return <div style={{ textAlign: 'right' }}>-</div>;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return <div style={{ textAlign: 'right' }}>{value}</div>;
  }
  
  let formatted;
  let displayUnit;
  
  if (unit === 'auto') {
    if (numValue >= 1024) {
      formatted = (numValue / 1024).toFixed(2);
      displayUnit = 'PB';
    } else if (numValue >= 1) {
      formatted = numValue.toFixed(2);
      displayUnit = 'TB';
    } else {
      formatted = (numValue * 1024).toFixed(0);
      displayUnit = 'GB';
    }
  } else {
    formatted = numValue.toFixed(2);
    displayUnit = unit;
  }
  
  return (
    <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
      {formatted} {displayUnit}
    </div>
  );
};

/**
 * Badge formatter for status-like values
 */
export const BadgeFormatter = ({ row, column, colorMap = {} }) => {
  const value = row[column.key];
  
  if (!value) return <div>-</div>;
  
  const defaultColors = {
    active: '#28a745',
    inactive: '#6c757d',
    pending: '#ffc107',
    error: '#dc3545',
    warning: '#fd7e14',
    info: '#17a2b8'
  };
  
  const color = colorMap[value?.toLowerCase()] || defaultColors[value?.toLowerCase()] || '#6c757d';
  
  return (
    <span style={{
      backgroundColor: color,
      color: 'white',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.8em',
      fontWeight: '500'
    }}>
      {value}
    </span>
  );
};

/**
 * Progress bar formatter
 */
export const ProgressFormatter = ({ row, column, max = 100 }) => {
  const value = row[column.key];
  
  if (value === null || value === undefined || value === '') {
    return <div>-</div>;
  }
  
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return <div>{value}</div>;
  }
  
  const percentage = Math.min(100, (numValue / max) * 100);
  const color = percentage > 90 ? '#dc3545' : percentage > 75 ? '#ffc107' : '#28a745';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        flex: 1,
        height: '8px',
        backgroundColor: '#e9ecef',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          backgroundColor: color,
          transition: 'width 0.3s ease'
        }} />
      </div>
      <span style={{ fontSize: '0.8em', minWidth: '40px' }}>
        {percentage.toFixed(0)}%
      </span>
    </div>
  );
};

/**
 * Link formatter for clickable values
 */
export const LinkFormatter = ({ row, column, onClick, href }) => {
  const value = row[column.key];
  
  if (!value) return <div>-</div>;
  
  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) {
      onClick(row, column, value);
    } else if (href) {
      window.open(href, '_blank');
    }
  };
  
  return (
    <a 
      href={href || '#'} 
      onClick={handleClick}
      style={{ 
        color: '#007bff',
        textDecoration: 'none',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
    >
      {value}
    </a>
  );
};

/**
 * Truncated text formatter with tooltip
 */
export const TruncatedTextFormatter = ({ row, column, maxLength = 50 }) => {
  const value = row[column.key];
  
  if (!value) return <div>-</div>;
  
  const text = String(value);
  const truncated = text.length > maxLength 
    ? text.substring(0, maxLength) + '...'
    : text;
  
  return (
    <div title={text} style={{ cursor: text.length > maxLength ? 'help' : 'default' }}>
      {truncated}
    </div>
  );
};

/**
 * Get appropriate formatter based on column configuration
 */
export const getFormatterForColumn = (column, options = {}) => {
  const { customFormatters = {} } = options;
  
  // Handle column structure - support both data and key properties
  const columnKey = column?.key || column?.data;
  
  // Safety check
  if (!column || !columnKey) {
    return ({ row, column }) => {
      const value = row[column?.key];
      return <div>{value || ''}</div>;
    };
  }
  
  // Check for custom formatter first
  if (customFormatters[columnKey]) {
    return customFormatters[columnKey];
  }
  
  // Check column type or key patterns
  if (columnKey.includes('status') || columnKey === 'zone_status') {
    return StatusFormatter;
  }
  
  if (column.type === 'checkbox' || columnKey.includes('_enabled') || columnKey.includes('include_')) {
    return BooleanFormatter;
  }
  
  if (column.type === 'percentage' || columnKey.includes('percent') || columnKey.includes('utilization')) {
    return PercentageFormatter;
  }
  
  if (column.type === 'date' || columnKey.includes('_date') || columnKey.includes('_time') || 
      columnKey === 'imported' || columnKey === 'updated' || columnKey === 'created') {
    return DateFormatter;
  }
  
  if (column.type === 'wwpn' || columnKey === 'wwpn') {
    return WWPNFormatter;
  }
  
  if (columnKey.includes('capacity') || columnKey.includes('_tb') || columnKey.includes('_gb')) {
    return CapacityFormatter;
  }
  
  if (column.type === 'number' || columnKey.includes('count') || columnKey.includes('_id')) {
    return (props) => <NumberFormatter {...props} decimals={column.decimals || 0} />;
  }
  
  if (columnKey === 'notes' || column.type === 'textarea') {
    return (props) => <TruncatedTextFormatter {...props} maxLength={100} />;
  }
  
  // Default formatter
  return ({ row, column }) => {
    const value = row[column?.key];
    return <div>{value || ''}</div>;
  };
};