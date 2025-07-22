import React from "react";
import PropTypes from "prop-types";

const SidebarHeader = ({ icon: Icon, title, isCollapsed }) => {
  return (
    <div className="sidebar-header">
      {Icon && (
        <div className="sidebar-header-icon">
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
};

export default SidebarHeader;