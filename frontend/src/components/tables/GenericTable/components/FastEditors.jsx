import React, { useState, useEffect, useRef } from 'react';

/**
 * Advanced dropdown editor with search functionality
 */
export const AdvancedDropdownEditor = ({ 
  row, 
  column, 
  onRowChange, 
  options = [],
  allowEmpty = true,
  searchable = true 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredOptions, setFilteredOptions] = useState(options);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  
  const currentValue = row[column.key] || '';

  useEffect(() => {
    if (searchable) {
      const filtered = options.filter(option =>
        option.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(options);
    }
  }, [searchTerm, options, searchable]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      setSearchTerm(currentValue);
      setIsOpen(true);
    }
  }, [currentValue]);

  const handleSelect = (value) => {
    onRowChange({ ...row, [column.key]: value });
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      handleSelect(filteredOptions[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (!searchable) {
    // Simple dropdown for non-searchable options
    return (
      <select
        className="form-control"
        value={currentValue}
        onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value })}
        autoFocus
        style={{ width: '100%', height: '100%', border: 'none' }}
      >
        {allowEmpty && <option value="">Select...</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        className="form-control"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Type to search..."
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
      
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderTop: 'none',
            zIndex: 1000,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          {allowEmpty && (
            <div
              onClick={() => handleSelect('')}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
            >
              <em>(Clear)</em>
            </div>
          )}
          
          {filteredOptions.map((option) => (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #eee',
                backgroundColor: option === currentValue ? '#e3f2fd' : 'white'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = option === currentValue ? '#e3f2fd' : 'white'}
            >
              {option}
            </div>
          ))}
          
          {filteredOptions.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#666', fontStyle: 'italic' }}>
              No matches found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Smart checkbox editor with better UX
 */
export const SmartCheckboxEditor = ({ row, column, onRowChange }) => {
  const value = Boolean(row[column.key]);
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%',
      width: '100%'
    }}>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onRowChange({ ...row, [column.key]: e.target.checked })}
        style={{ 
          width: '18px', 
          height: '18px',
          cursor: 'pointer'
        }}
        autoFocus
      />
    </div>
  );
};

/**
 * Number editor with validation
 */
export const NumberEditor = ({ 
  row, 
  column, 
  onRowChange, 
  min = null, 
  max = null, 
  step = 1,
  decimals = 0 
}) => {
  const value = row[column.key] || '';
  
  const handleChange = (e) => {
    let newValue = e.target.value;
    
    // Basic validation
    if (newValue === '') {
      onRowChange({ ...row, [column.key]: null });
      return;
    }
    
    const numValue = decimals > 0 ? parseFloat(newValue) : parseInt(newValue);
    
    if (isNaN(numValue)) return;
    
    if (min !== null && numValue < min) return;
    if (max !== null && numValue > max) return;
    
    onRowChange({ ...row, [column.key]: numValue });
  };

  return (
    <input
      type="number"
      className="form-control"
      value={value}
      onChange={handleChange}
      min={min}
      max={max}
      step={step}
      autoFocus
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
};

/**
 * Date editor
 */
export const DateEditor = ({ row, column, onRowChange }) => {
  const value = row[column.key];
  
  // Convert to date string format
  const dateValue = value ? (value instanceof Date ? value.toISOString().split('T')[0] : value) : '';
  
  return (
    <input
      type="date"
      className="form-control"
      value={dateValue}
      onChange={(e) => onRowChange({ ...row, [column.key]: e.target.value })}
      autoFocus
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
};

/**
 * Text editor with validation
 */
export const TextEditor = ({ 
  row, 
  column, 
  onRowChange, 
  maxLength = null,
  pattern = null,
  placeholder = '' 
}) => {
  const value = row[column.key] || '';
  
  const handleChange = (e) => {
    let newValue = e.target.value;
    
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.substring(0, maxLength);
    }
    
    if (pattern && !new RegExp(pattern).test(newValue) && newValue !== '') {
      return; // Don't update if pattern doesn't match
    }
    
    onRowChange({ ...row, [column.key]: newValue });
  };

  return (
    <input
      type="text"
      className="form-control"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  );
};

/**
 * Textarea editor for longer text
 */
export const TextareaEditor = ({ row, column, onRowChange, maxLength = 500 }) => {
  const value = row[column.key] || '';
  
  return (
    <textarea
      className="form-control"
      value={value}
      onChange={(e) => {
        let newValue = e.target.value;
        if (newValue.length > maxLength) {
          newValue = newValue.substring(0, maxLength);
        }
        onRowChange({ ...row, [column.key]: newValue });
      }}
      autoFocus
      rows={3}
      style={{ 
        width: '100%', 
        minHeight: '60px',
        border: 'none',
        resize: 'vertical'
      }}
    />
  );
};

/**
 * WWPN (World Wide Port Name) editor with formatting
 */
export const WWPNEditor = ({ row, column, onRowChange }) => {
  const value = row[column.key] || '';
  
  const formatWWPN = (value) => {
    // Remove all non-hex characters
    const cleaned = value.replace(/[^0-9a-fA-F]/g, '');
    
    // Add colons every 2 characters
    if (cleaned.length <= 16) {
      return cleaned.replace(/(.{2})/g, '$1:').replace(/:$/, '');
    }
    
    return cleaned.substring(0, 16).replace(/(.{2})/g, '$1:').replace(/:$/, '');
  };
  
  const handleChange = (e) => {
    const formatted = formatWWPN(e.target.value);
    onRowChange({ ...row, [column.key]: formatted });
  };

  return (
    <input
      type="text"
      className="form-control"
      value={value}
      onChange={handleChange}
      placeholder="XX:XX:XX:XX:XX:XX:XX:XX"
      autoFocus
      style={{ 
        width: '100%', 
        height: '100%', 
        border: 'none',
        fontFamily: 'monospace'
      }}
    />
  );
};

/**
 * Get appropriate editor based on column configuration
 */
export const getEditorForColumn = (column, options = {}) => {
  const { dropdownSources = {}, customEditors = {} } = options;
  
  // Handle column structure - support both data and key properties
  const columnKey = column.key || column.data;
  
  // Safety check
  if (!columnKey) {
    return (props) => <TextEditor {...props} />;
  }
  
  // Check for custom editor first
  if (customEditors[columnKey]) {
    return customEditors[columnKey];
  }
  
  // Check column type
  switch (column.type) {
    case 'dropdown':
      const dropdownOptions = dropdownSources[columnKey] || [];
      return (props) => (
        <AdvancedDropdownEditor 
          {...props} 
          options={dropdownOptions}
          searchable={dropdownOptions.length > 10}
        />
      );
      
    case 'checkbox':
      return SmartCheckboxEditor;
      
    case 'number':
      return (props) => (
        <NumberEditor 
          {...props}
          min={column.min}
          max={column.max}
          step={column.step}
          decimals={column.decimals}
        />
      );
      
    case 'date':
      return DateEditor;
      
    case 'textarea':
      return (props) => (
        <TextareaEditor 
          {...props}
          maxLength={column.maxLength}
        />
      );
      
    case 'wwpn':
      return WWPNEditor;
      
    default:
      return (props) => (
        <TextEditor 
          {...props}
          maxLength={column.maxLength}
          pattern={column.pattern}
          placeholder={column.placeholder}
        />
      );
  }
};