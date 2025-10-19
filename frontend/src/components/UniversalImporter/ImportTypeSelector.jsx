import React from 'react';
import {
  Database,
  Server,
  HardDrive,
  Check,
  Lock,
  TrendingUp,
  Zap,
  Shield,
  Clock
} from 'lucide-react';
import './styles/ImportTypeSelector.css';

const ImportTypeSelector = ({ selectedType, onTypeSelect, theme }) => {
  const importTypes = [
    {
      id: 'san',
      title: 'SAN Zoning Configuration',
      description: 'Import fabric zones, aliases, and WWPNs',
      icon: Database,
      color: 'primary',
      available: true,
      features: [
        { icon: Check, text: 'Cisco MDS Support' },
        { icon: Check, text: 'Brocade Support' },
        { icon: Check, text: 'Zone & Alias Import' },
        { icon: Shield, text: 'Conflict Detection' }
      ],
      stats: {
        icon: TrendingUp,
        value: '10K+',
        label: 'Zones Imported'
      }
    },
    {
      id: 'storage',
      title: 'Storage Systems',
      description: 'Import storage arrays and volume configurations',
      icon: HardDrive,
      color: 'success',
      available: false,
      comingSoon: true,
      features: [
        { icon: Clock, text: 'EMC VMAX/PowerMax' },
        { icon: Clock, text: 'NetApp Arrays' },
        { icon: Clock, text: 'Pure Storage' },
        { icon: Clock, text: 'Volume Mapping' }
      ],
      stats: {
        icon: Clock,
        value: 'Q1 2025',
        label: 'Coming Soon'
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
        { icon: Clock, text: 'VMware vCenter' },
        { icon: Clock, text: 'Physical Servers' },
        { icon: Clock, text: 'HBA Configuration' },
        { icon: Clock, text: 'Multipath Settings' }
      ],
      stats: {
        icon: Clock,
        value: 'Q2 2025',
        label: 'Coming Soon'
      }
    }
  ];

  return (
    <div className={`import-type-selector theme-${theme}`}>
      <div className="selector-grid">
        {importTypes.map((type) => (
          <div
            key={type.id}
            className={`import-card ${selectedType === type.id ? 'selected' : ''} ${
              !type.available ? 'disabled' : ''
            } color-${type.color}`}
            onClick={() => type.available && onTypeSelect(type.id)}
          >
            {/* Coming Soon Ribbon */}
            {type.comingSoon && (
              <div className="coming-soon-ribbon">
                <span>Coming Soon</span>
              </div>
            )}

            {/* Card Background Effects */}
            <div className="card-bg-gradient" />
            <div className="card-bg-pattern" />
            <div className="card-glow" />

            {/* Card Content */}
            <div className="card-content">
              {/* Header */}
              <div className="card-header">
                <div className="icon-container">
                  <div className="icon-bg">
                    <type.icon size={32} strokeWidth={1.5} />
                  </div>
                  {type.available && (
                    <div className="icon-badge">
                      <Zap size={14} />
                    </div>
                  )}
                </div>
                <div className="card-titles">
                  <h3>{type.title}</h3>
                  <p>{type.description}</p>
                </div>
              </div>

              {/* Features List */}
              <div className="card-features">
                {type.features.map((feature, idx) => (
                  <div key={idx} className="feature-item">
                    <feature.icon size={16} />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>

              {/* Stats/Status */}
              <div className="card-footer">
                <div className="stats-container">
                  <type.stats.icon size={18} />
                  <div className="stats-content">
                    <div className="stats-value">{type.stats.value}</div>
                    <div className="stats-label">{type.stats.label}</div>
                  </div>
                </div>

                {type.available ? (
                  <button className="select-button">
                    <span>Select</span>
                    <svg
                      className="button-arrow"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M5 12H19M19 12L12 5M19 12L12 19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : (
                  <div className="locked-indicator">
                    <Lock size={20} />
                  </div>
                )}
              </div>

              {/* Selection Indicator */}
              {selectedType === type.id && type.available && (
                <div className="selection-indicator">
                  <Check size={20} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Feature Comparison Table (Optional) */}
      <div className="comparison-hint">
        <div className="hint-content">
          <span className="hint-icon">💡</span>
          <span className="hint-text">
            Select the type of data you want to import. More import types coming soon!
          </span>
        </div>
      </div>
    </div>
  );
};

export default ImportTypeSelector;