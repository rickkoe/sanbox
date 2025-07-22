import React from "react";
import PropTypes from "prop-types";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SidebarToggle = ({ isCollapsed, onToggle }) => {
  return (
    <button 
      className="sidebar-toggle"
      onClick={onToggle}
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
    </button>
  );
};

SidebarToggle.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default SidebarToggle;