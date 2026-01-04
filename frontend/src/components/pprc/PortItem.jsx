import React, { useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';

const ITEM_TYPE = 'PORT';

/**
 * PortItem - Draggable port that can be connected to other ports
 */
const PortItem = ({ port, side, onCreatePath, registerPortRef, isConnected, showFabric, fabricColor }) => {
  const ref = useRef(null);

  // Register this port's DOM element for SVG line positioning
  // Key includes side to handle same storage on both sides
  const refKey = `${side}-${port.id}`;
  useEffect(() => {
    if (ref.current) {
      registerPortRef(refKey, ref.current);
    }
    return () => {
      registerPortRef(refKey, null);
    };
  }, [refKey, registerPortRef]);

  // Drag source
  const [{ isDragging }, drag] = useDrag({
    type: ITEM_TYPE,
    item: { id: port.id, side },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop target
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: ITEM_TYPE,
    canDrop: (item) => {
      // Can only drop on ports from the other side
      return item.side !== side && item.id !== port.id;
    },
    drop: (item) => {
      onCreatePath(item.id, port.id);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Combine drag and drop refs
  drag(drop(ref));

  const className = [
    'pprc-port-item',
    `pprc-port-${side}`,
    isDragging && 'pprc-port-dragging',
    isOver && canDrop && 'pprc-port-drop-target',
    isOver && !canDrop && 'pprc-port-drop-invalid',
    isConnected && 'pprc-port-connected',
  ].filter(Boolean).join(' ');

  // Tooltip for invalid drop
  const invalidDropTitle = isOver && !canDrop ? "Cannot connect a port to itself" : undefined;

  // Format WWPN for display
  const formatWwpn = (wwpn) => {
    if (!wwpn) return '';
    // Add colons if not present
    if (!wwpn.includes(':')) {
      return wwpn.match(/.{1,2}/g)?.join(':') || wwpn;
    }
    return wwpn;
  };

  return (
    <div ref={ref} className={className} title={invalidDropTitle}>
      <div className="pprc-port-connector" />
      <div className="pprc-port-info">
        <div className="pprc-port-name">
          {port.name}
          {port.port_id && <span className="pprc-port-id"> ({port.port_id})</span>}
        </div>
        <div className="pprc-port-details">
          {port.wwpn && (
            <span className="pprc-port-wwpn" title={port.wwpn}>
              {formatWwpn(port.wwpn)}
            </span>
          )}
          {port.frame && (
            <span className="pprc-port-location">
              Frame {port.frame}
              {port.io_enclosure && `-${port.io_enclosure}`}
            </span>
          )}
        </div>
        <div className="pprc-port-badges">
          <span className={`badge ${port.use === 'replication' ? 'bg-primary' : 'bg-info'}`}>
            {port.use}
          </span>
          {showFabric && port.fabric_name && (
            <span
              className="badge pprc-fabric-badge"
              style={{ backgroundColor: fabricColor || '#6c757d' }}
            >
              {port.fabric_name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortItem;
