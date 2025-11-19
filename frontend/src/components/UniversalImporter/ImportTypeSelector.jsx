import React from 'react';
import {
  Database,
  Server,
  Check
} from 'lucide-react';

const ImportTypeSelector = ({ selectedType, onTypeSelect, projectActive = true }) => {
  const importTypes = [
    {
      id: 'san',
      title: 'SAN Zoning Configuration',
      description: 'Import SAN fabric zones, aliases, and device configurations',
      icon: Database,
      features: [
        'Cisco MDS & Brocade switches',
        'Zones, aliases, and fabrics',
        'Multi-fabric support',
        'Conflict resolution'
      ],
      available: true
    },
    {
      id: 'storage',
      title: 'IBM Storage Insights',
      description: 'Import storage systems, volumes, and hosts from IBM Storage Insights',
      icon: Server,
      features: [
        'Storage systems & volumes',
        'Host & WWPNs',
        'Real-time API sync',
        'Selective import'
      ],
      available: true
    }
  ];

  return (
    <div className="import-type-grid">
      {importTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = selectedType === type.id;
        const isDisabled = !type.available || !projectActive;

        return (
          <div
            key={type.id}
            className={`import-type-card ${isSelected ? 'selected' : ''} ${
              isDisabled ? 'disabled' : ''
            }`}
            onClick={() => !isDisabled && onTypeSelect(type.id)}
          >
            {!type.available && (
              <div className="coming-soon-badge">Coming Soon</div>
            )}

            <div className="import-type-icon">
              <Icon size={28} strokeWidth={1.5} />
            </div>

            <div className="import-type-title">{type.title}</div>
            <div className="import-type-description">{type.description}</div>

            <div className="import-type-features">
              {type.features.map((feature, index) => (
                <div key={index} className="import-type-feature">
                  <Check size={14} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ImportTypeSelector;
