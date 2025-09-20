import React from 'react';
import { 
  FaPlus, FaPalette, FaLayerGroup, FaCog, FaTrash, 
  FaClone, FaEye, FaEyeSlash, FaDownload, FaUpload 
} from 'react-icons/fa';

export const DashboardToolbar = ({ 
  onAddWidget, 
  onChangeTheme, 
  onLoadPreset,
  selectedWidget,
  onWidgetConfig 
}) => {
  return (
    <div className="dashboard-toolbar">
      <div className="toolbar-section">
        <h3>Add Content</h3>
        <button className="toolbar-btn" onClick={onAddWidget}>
          <FaPlus /> Add Widget
        </button>
        <button className="toolbar-btn" onClick={onLoadPreset}>
          <FaLayerGroup /> Load Template
        </button>
      </div>

      <div className="toolbar-section">
        <h3>Appearance</h3>
        <button className="toolbar-btn" onClick={onChangeTheme}>
          <FaPalette /> Change Theme
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