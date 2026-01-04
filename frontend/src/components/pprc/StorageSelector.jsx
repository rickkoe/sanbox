import React from 'react';
import { Form } from 'react-bootstrap';

/**
 * StorageSelector - Dropdown for selecting a DS8000 storage system
 */
const StorageSelector = ({ label, value, onChange, options, excludeId }) => {
  const filteredOptions = excludeId
    ? options.filter(s => s.id !== excludeId)
    : options;

  return (
    <div className="pprc-storage-selector">
      <Form.Group>
        <Form.Label className="pprc-selector-label">{label}</Form.Label>
        <Form.Select
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
          className="pprc-selector-dropdown"
        >
          <option value="">-- Select Storage --</option>
          {filteredOptions.map(storage => (
            <option key={storage.id} value={storage.id}>
              {storage.name}
              {storage.location ? ` (${storage.location})` : ''}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </div>
  );
};

export default StorageSelector;
