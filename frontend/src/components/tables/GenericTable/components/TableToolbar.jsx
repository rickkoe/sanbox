import React from 'react';
import TableControls from './TableControls';
import './TableToolbar.css';

const TableToolbar = ({ tableControlsProps }) => {
  if (!tableControlsProps) return null;

  return (
    <div className="table-toolbar">
      <div className="table-toolbar-content">
        <TableControls {...tableControlsProps} />
      </div>
    </div>
  );
};

export default TableToolbar;