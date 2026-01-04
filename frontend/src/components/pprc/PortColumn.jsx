import React from 'react';
import PortItem from './PortItem';

/**
 * PortColumn - Displays a list of ports for a storage system
 */
const PortColumn = ({ ports, side, onCreatePath, registerPortRef, connectedPortIds }) => {
  if (!ports || ports.length === 0) {
    return (
      <div className="pprc-port-list pprc-port-list-empty">
        <p className="text-muted">
          No replication-capable FC ports found.
          <br />
          <small>Ports must have use set to "Replication" or "Both".</small>
        </p>
      </div>
    );
  }

  return (
    <div className="pprc-port-list">
      <div className="pprc-port-list-header">
        <span className="pprc-port-count">{ports.length} port{ports.length !== 1 ? 's' : ''}</span>
      </div>
      {ports.map(port => (
        <PortItem
          key={port.id}
          port={port}
          side={side}
          onCreatePath={onCreatePath}
          registerPortRef={registerPortRef}
          isConnected={connectedPortIds.includes(port.id)}
        />
      ))}
    </div>
  );
};

export default PortColumn;
