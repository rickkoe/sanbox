import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

const SidebarHeader = ({ icon: Icon, title, isCollapsed, onToggle, showBackButton, backPath }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    }
  };

  return (
    <div className="sidebar-header">
      {showBackButton && !isCollapsed && (
        <div
          className="sidebar-back-button"
          onClick={handleBack}
          title="Back to Storage Systems"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </div>
      )}
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
  showBackButton: PropTypes.bool,
  backPath: PropTypes.string,
};

SidebarHeader.defaultProps = {
  showBackButton: false,
  backPath: null,
};

export default SidebarHeader;