import React, { useState } from 'react';
import { Dropdown } from 'react-bootstrap';
import {
  Database,
  Server,
  HardDrive,
  Check,
  Lock,
  TrendingUp,
  Shield,
  Clock,
  ChevronDown
} from 'lucide-react';
import './styles/ImportTypeSelector.css';

const ImportTypeSelector = ({ selectedType, onTypeSelect, theme }) => {
  const [isOpen, setIsOpen] = useState(false);

  const importTypes = [
    {
      id: 'san',
      title: 'SAN Zoning Configuration',
      description: 'Import fabric zones, aliases, and WWPNs',
      icon: Database,
      color: 'primary',
      available: true,
      features: [
        'Cisco MDS Support',
        'Brocade Support',
        'Zone & Alias Import',
        'Conflict Detection'
      ],
      badge: {
        text: 'Popular',
        color: 'var(--color-accent-emphasis)'
      }
    },
    {
      id: 'storage',
      title: 'IBM Storage Insights',
      description: 'Import storage systems, volumes, and hosts from IBM Storage Insights API',
      icon: HardDrive,
      color: 'success',
      available: true,
      features: [
        'IBM FlashSystem',
        'IBM DS8000',
        'Volumes & Hosts',
        'Automatic Updates'
      ],
      badge: {
        text: 'New',
        color: 'var(--color-success-emphasis)'
      }
    },
    {
      id: 'hosts',
      title: 'Hosts & Servers',
      description: 'Import server configurations and HBA details',
      icon: Server,
      color: 'info',
      available: false,
      comingSoon: true,
      features: [
        'Power & IBMi',
        'Physical Servers',
        'HBA Configuration',
        'Multipath Settings'
      ],
      badge: {
        text: 'Coming Q1 2026',
        color: 'var(--color-attention-emphasis)'
      }
    }
  ];

  const selectedTypeObj = importTypes.find(t => t.id === selectedType);

  const handleSelect = (typeId) => {
    const type = importTypes.find(t => t.id === typeId);
    if (type.available) {
      onTypeSelect(typeId);
      setIsOpen(false);
    }
  };

  return (
    <div className={`import-type-selector theme-${theme}`}>
      <div className="selector-label">
        <Database size={20} />
        <span>Select Import Type</span>
      </div>

      <Dropdown
        show={isOpen}
        onToggle={setIsOpen}
        className="import-type-dropdown-wrapper"
      >
        <Dropdown.Toggle
          variant="outline-secondary"
          className="import-type-dropdown-toggle"
        >
          <div className="dropdown-selected-content">
            {selectedTypeObj ? (
              <>
                <selectedTypeObj.icon size={24} />
                <div className="selected-text">
                  <div className="selected-title">{selectedTypeObj.title}</div>
                  <div className="selected-description">{selectedTypeObj.description}</div>
                </div>
              </>
            ) : (
              <span className="placeholder-text">Choose an import type...</span>
            )}
          </div>
          <ChevronDown size={20} className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
        </Dropdown.Toggle>

        <Dropdown.Menu className="import-type-dropdown-menu">
          {importTypes.map((type) => (
            <Dropdown.Item
              key={type.id}
              onClick={() => handleSelect(type.id)}
              className={`import-type-option ${!type.available ? 'disabled' : ''} ${selectedType === type.id ? 'selected' : ''}`}
              disabled={!type.available}
            >
              <div className="option-content">
                <div className="option-header">
                  <div className="option-icon-container">
                    <type.icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="option-main">
                    <div className="option-title-row">
                      <h4>{type.title}</h4>
                      {type.badge && (
                        <span
                          className={`option-badge ${type.id === 'san' ? 'badge-popular' : type.id === 'storage' ? 'badge-new' : 'badge-coming-soon'}`}
                        >
                          {type.badge.text}
                        </span>
                      )}
                    </div>
                    <p className="option-description">{type.description}</p>
                  </div>
                  {selectedType === type.id && type.available && (
                    <div className="option-selected-indicator">
                      <Check size={20} />
                    </div>
                  )}
                  {!type.available && (
                    <div className="option-locked-indicator">
                      <Lock size={20} />
                    </div>
                  )}
                </div>

                <div className="option-features">
                  {type.features.map((feature, idx) => (
                    <div key={idx} className="feature-tag">
                      {type.available ? <Check size={14} /> : <Clock size={14} />}
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default ImportTypeSelector;