import React from "react";
import PropTypes from "prop-types";
import { ChevronLeft } from "lucide-react";

const SidebarBackButton = ({ isCollapsed, onClick }) => {
  return (
    <button
      className="sidebar-back-button"
      onClick={onClick}
      title="Go back"
    >
      <ChevronLeft size={16} />
      {!isCollapsed && <span>Back</span>}
    </button>
  );
};

SidebarBackButton.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default SidebarBackButton;