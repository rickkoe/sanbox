import React from 'react';
import { 
  FaPlus, FaLayerGroup, FaCog, FaTrash, 
  FaClone, FaEye, FaEyeSlash, FaDownload, FaUpload 
} from 'react-icons/fa';

export const DashboardToolbar = ({ 
  onAddWidget, 
  onLoadPreset,
  selectedWidget,
  onWidgetConfig 
}) => {
  return (
    <div className="dashboard-toolbar">
      <div className="toolbar-section">
        <h3>Manage Content</h3>
        <button className="toolbar-btn" onClick={onAddWidget}>
          <FaPlus /> Manage Widgets
        </button>
        <button className="toolbar-btn" onClick={onLoadPreset}>
          <FaLayerGroup /> Load Template
        </button>
      </div>


      {selectedWidget && (
        <div className="toolbar-section">
          <h3>Selected Widget</h3>
          <button className="toolbar-btn" onClick={() => onWidgetConfig(selectedWidget)}>
            <FaCog /> Configure
          </button>
          <button className="toolbar-btn">
            <FaClone /> Duplicate
          </button>
          <button className="toolbar-btn">
            <FaEyeSlash /> Hide
          </button>
          <button className="toolbar-btn danger">
            <FaTrash /> Remove
          </button>
        </div>
      )}

      <div className="toolbar-section">
        <h3>Import/Export</h3>
        <button className="toolbar-btn">
          <FaDownload /> Export
        </button>
        <button className="toolbar-btn">
          <FaUpload /> Import
        </button>
      </div>
    </div>
  );
};