import React, { useState, useEffect, useCallback } from 'react';

/**
 * ConnectionLines - Renders SVG lines between connected ports
 */
const ConnectionLines = ({ paths, portRefs, portRefsVersion, containerRef, onDeletePath, leftStorageId, rightStorageId }) => {
  const [lines, setLines] = useState([]);

  // Calculate line positions based on port element positions
  const calculateLines = useCallback(() => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines = [];

    paths.forEach(path => {
      // Determine which port is on which side based on storage ownership
      const port1StorageId = path.port1_details?.storage_id;
      const port2StorageId = path.port2_details?.storage_id;

      let leftPortId, rightPortId;

      // Figure out which port goes on left vs right
      if (port1StorageId === leftStorageId && port2StorageId === rightStorageId) {
        leftPortId = path.port1;
        rightPortId = path.port2;
      } else if (port2StorageId === leftStorageId && port1StorageId === rightStorageId) {
        leftPortId = path.port2;
        rightPortId = path.port1;
      } else if (leftStorageId === rightStorageId) {
        // Same storage on both sides - use port1 on left, port2 on right
        leftPortId = path.port1;
        rightPortId = path.port2;
      } else {
        // Skip if neither port matches the displayed storages
        return;
      }

      // Look up refs with side prefix
      const leftEl = portRefs[`left-${leftPortId}`];
      const rightEl = portRefs[`right-${rightPortId}`];

      if (leftEl && rightEl) {
        const leftRect = leftEl.getBoundingClientRect();
        const rightRect = rightEl.getBoundingClientRect();

        // Get the connector element positions
        const leftConnector = leftEl.querySelector('.pprc-port-connector');
        const rightConnector = rightEl.querySelector('.pprc-port-connector');

        let x1, y1, x2, y2;

        if (leftConnector && rightConnector) {
          const leftConnRect = leftConnector.getBoundingClientRect();
          const rightConnRect = rightConnector.getBoundingClientRect();

          // Use connector center positions
          x1 = leftConnRect.left + leftConnRect.width / 2 - containerRect.left;
          y1 = leftConnRect.top + leftConnRect.height / 2 - containerRect.top;
          x2 = rightConnRect.left + rightConnRect.width / 2 - containerRect.left;
          y2 = rightConnRect.top + rightConnRect.height / 2 - containerRect.top;
        } else {
          // Fallback: use port element edges
          x1 = leftRect.right - containerRect.left;
          y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
          x2 = rightRect.left - containerRect.left;
          y2 = rightRect.top + rightRect.height / 2 - containerRect.top;
        }

        newLines.push({
          id: path.id,
          x1,
          y1,
          x2,
          y2,
          path,
        });
      }
    });

    setLines(newLines);
  }, [paths, portRefs, portRefsVersion, containerRef, leftStorageId, rightStorageId]);

  // Recalculate lines when paths or refs change
  useEffect(() => {
    calculateLines();

    // Recalculate on window resize
    window.addEventListener('resize', calculateLines);

    // Add scroll listeners to port list containers
    const portLists = containerRef.current?.querySelectorAll('.pprc-port-list') || [];
    portLists.forEach(list => {
      list.addEventListener('scroll', calculateLines);
    });

    // Also recalculate after a short delay to account for layout settling
    const timeout = setTimeout(calculateLines, 100);

    return () => {
      window.removeEventListener('resize', calculateLines);
      portLists.forEach(list => {
        list.removeEventListener('scroll', calculateLines);
      });
      clearTimeout(timeout);
    };
  }, [calculateLines, containerRef]);

  // Recalculate when port refs change (triggered by portRefsVersion)
  useEffect(() => {
    const timeout = setTimeout(calculateLines, 50);
    return () => clearTimeout(timeout);
  }, [portRefsVersion, calculateLines]);

  if (lines.length === 0) {
    return null;
  }

  return (
    <svg className="pprc-connection-lines">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="var(--pprc-line-color)" />
        </marker>
      </defs>
      {lines.map(line => {
        // Calculate control points for a curved line
        const midX = (line.x1 + line.x2) / 2;
        const curve = `M ${line.x1} ${line.y1} Q ${midX} ${line.y1}, ${midX} ${(line.y1 + line.y2) / 2} T ${line.x2} ${line.y2}`;

        // Use a straight line for cleaner look
        const straight = `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`;

        return (
          <g key={line.id} className="pprc-connection-group">
            {/* Invisible wider path for easier clicking */}
            <path
              d={straight}
              className="pprc-connection-hitarea"
              onClick={() => onDeletePath(line.id)}
              title={`Click to delete: ${line.path.port1_details?.name} to ${line.path.port2_details?.name}`}
            />
            {/* Visible line */}
            <path
              d={straight}
              className="pprc-connection-line"
              onClick={() => onDeletePath(line.id)}
            />
            {/* Connection endpoints */}
            <circle cx={line.x1} cy={line.y1} r="4" className="pprc-connection-endpoint" />
            <circle cx={line.x2} cy={line.y2} r="4" className="pprc-connection-endpoint" />
          </g>
        );
      })}
    </svg>
  );
};

export default ConnectionLines;
