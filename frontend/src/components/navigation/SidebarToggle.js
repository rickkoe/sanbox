import React from "react";
import PropTypes from "prop-types";
import { Menu } from "lucide-react";

const SidebarToggle = ({ isCollapsed, onToggle }) => {
  return (
    <button 
      className="navbar-sidebar-toggle"
      onClick={onToggle}
      title={isCollapsed ? "Show sidebar" : "Hide sidebar"}
    >
      <Menu size={20} />
    </button>
  );
};

SidebarToggle.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default SidebarToggle;