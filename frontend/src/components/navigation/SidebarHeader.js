import React from "react";
import PropTypes from "prop-types";

const SidebarHeader = ({ icon: Icon, title, isCollapsed, onToggle }) => {
  return (
    <div className="sidebar-header">
      {Icon && (
        <div 
          className="sidebar-toggle-icon" 
          onClick={onToggle}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon size={isCollapsed ? 20 : 24} />
        </div>
      )}
      {!isCollapsed && (
        <div className="sidebar-header-content">
          <h3 className="sidebar-title">{title}</h3>
        </div>
      )}
    </div>
  );
};

SidebarHeader.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  isCollapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func,
};

export default SidebarHeader;