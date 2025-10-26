import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import './SampleDropdowns.css';

/**
 * Standardized Dropdown Component
 * - Theme-aware
 * - Searchable
 * - Multi-select support
 * - Custom rendering
 */
export const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  multi = false,
  disabled = false,
  renderOption,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = searchable && searchTerm
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const handleSelect = (option) => {
    if (multi) {
      const newValue = Array.isArray(value) ? [...value] : [];
      const index = newValue.findIndex(v => v === option.value);
      if (index > -1) {
        newValue.splice(index, 1);
      } else {
        newValue.push(option.value);
      }
      onChange(newValue);
    } else {
      onChange(option.value);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const isSelected = (option) => {
    if (multi) {
      return Array.isArray(value) && value.includes(option.value);
    }
    return value === option.value;
  };

  const getDisplayValue = () => {
    if (multi) {
      if (!Array.isArray(value) || value.length === 0) return placeholder;
      const selectedOptions = options.filter(opt => value.includes(opt.value));
      return selectedOptions.map(opt => opt.label).join(', ');
    }
    const selected = options.find(opt => opt.value === value);
    return selected ? selected.label : placeholder;
  };

  return (
    <div
      ref={dropdownRef}
      className={`dropdown ${isOpen ? 'dropdown-open' : ''} ${disabled ? 'dropdown-disabled' : ''} ${className}`}
    >
      <button
        type="button"
        className="dropdown-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="dropdown-value">{getDisplayValue()}</span>
        <ChevronDown
          size={16}
          className={`dropdown-icon ${isOpen ? 'dropdown-icon-open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {searchable && (
            <div className="dropdown-search">
              <Search size={16} className="dropdown-search-icon" />
              <input
                type="text"
                className="dropdown-search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="dropdown-options">
            {filteredOptions.length === 0 ? (
              <div className="dropdown-option-empty">No options found</div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`dropdown-option ${isSelected(option) ? 'dropdown-option-selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  {renderOption ? (
                    renderOption(option, isSelected(option))
                  ) : (
                    <>
                      <span className="dropdown-option-label">{option.label}</span>
                      {isSelected(option) && (
                        <Check size={16} className="dropdown-option-check" />
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Demo Component - Shows dropdown variants
 */
const SampleDropdowns = () => {
  const [simpleValue, setSimpleValue] = useState('');
  const [searchableValue, setSearchableValue] = useState('');
  const [multiValue, setMultiValue] = useState([]);

  const simpleOptions = [
    { value: 'fabric-a', label: 'Fabric A' },
    { value: 'fabric-b', label: 'Fabric B' },
    { value: 'fabric-c', label: 'Fabric C' }
  ];

  const searchableOptions = [
    { value: '1', label: 'Active' },
    { value: '2', label: 'Inactive' },
    { value: '3', label: 'Pending' },
    { value: '4', label: 'Archived' },
    { value: '5', label: 'Deleted' },
    { value: '6', label: 'Draft' },
    { value: '7', label: 'Published' },
    { value: '8', label: 'Scheduled' }
  ];

  const multiOptions = [
    { value: 'zone', label: 'Zone' },
    { value: 'alias', label: 'Alias' },
    { value: 'fabric', label: 'Fabric' },
    { value: 'switch', label: 'Switch' },
    { value: 'storage', label: 'Storage' },
    { value: 'host', label: 'Host' }
  ];

  return (
    <div className="sample-dropdowns-demo">
      <h2 className="demo-section-title">Dropdown Examples</h2>
      <p className="demo-section-desc">
        Standardized, theme-aware dropdowns for consistent selection UX
      </p>

      <div className="dropdown-demo-grid">
        {/* Simple Dropdown */}
        <div className="dropdown-demo-item">
          <h4>Simple Dropdown</h4>
          <p className="dropdown-demo-desc">Basic single-select dropdown</p>
          <Dropdown
            options={simpleOptions}
            value={simpleValue}
            onChange={setSimpleValue}
            placeholder="Select fabric..."
          />
          {simpleValue && (
            <div className="dropdown-demo-value">
              Selected: <strong>{simpleValue}</strong>
            </div>
          )}
        </div>

        {/* Searchable Dropdown */}
        <div className="dropdown-demo-item">
          <h4>Searchable Dropdown</h4>
          <p className="dropdown-demo-desc">With search/filter capability</p>
          <Dropdown
            options={searchableOptions}
            value={searchableValue}
            onChange={setSearchableValue}
            placeholder="Select status..."
            searchable
          />
          {searchableValue && (
            <div className="dropdown-demo-value">
              Selected: <strong>{searchableValue}</strong>
            </div>
          )}
        </div>

        {/* Multi-Select Dropdown */}
        <div className="dropdown-demo-item">
          <h4>Multi-Select Dropdown</h4>
          <p className="dropdown-demo-desc">Select multiple options</p>
          <Dropdown
            options={multiOptions}
            value={multiValue}
            onChange={setMultiValue}
            placeholder="Select types..."
            multi
            searchable
          />
          {multiValue.length > 0 && (
            <div className="dropdown-demo-value">
              Selected: <strong>{multiValue.join(', ')}</strong>
            </div>
          )}
        </div>

        {/* Disabled Dropdown */}
        <div className="dropdown-demo-item">
          <h4>Disabled Dropdown</h4>
          <p className="dropdown-demo-desc">Non-interactive state</p>
          <Dropdown
            options={simpleOptions}
            value="fabric-a"
            onChange={() => {}}
            disabled
          />
        </div>

        {/* Custom Rendered Dropdown */}
        <div className="dropdown-demo-item">
          <h4>Custom Rendered</h4>
          <p className="dropdown-demo-desc">Custom option rendering</p>
          <Dropdown
            options={searchableOptions}
            value={searchableValue}
            onChange={setSearchableValue}
            placeholder="Select status..."
            renderOption={(option, isSelected) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isSelected ? 'var(--color-success-emphasis)' : 'var(--color-border-default)'
                  }}
                />
                <span>{option.label}</span>
                {isSelected && <Check size={16} />}
              </div>
            )}
          />
        </div>

        {/* Usage Example */}
        <div className="dropdown-demo-item dropdown-demo-code">
          <h4>Usage Example</h4>
          <pre className="code-block">
{`<Dropdown
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' }
  ]}
  value={value}
  onChange={setValue}
  placeholder="Select..."
  searchable
  multi={false}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SampleDropdowns;
