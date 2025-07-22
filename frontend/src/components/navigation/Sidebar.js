import React, { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { useSidebarConfig } from "../../hooks/useSidebarConfig";
import SidebarHeader from "./SidebarHeader";
import SidebarToggle from "./SidebarToggle";
import SidebarBackButton from "./SidebarBackButton";
import SidebarNavigation from "./SidebarNavigation";

const Sidebar = ({ onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { icon, links, showBackButton, backPath, dynamicHeader } = useSidebarConfig();

  const handleToggle = useCallback(() => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  }, [isCollapsed, onCollapseChange]);

  const handleBackClick = useCallback(() => {
    if (backPath) {
      navigate(backPath);
    } else if (location.pathname.startsWith("/storage")) {
      navigate("/");
    } else {
      navigate("/");
    }
  }, [backPath, location.pathname, navigate]);

  return (
    <div className={`modern-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <SidebarToggle isCollapsed={isCollapsed} onToggle={handleToggle} />
      
      <SidebarHeader 
        icon={icon} 
        title={dynamicHeader} 
        isCollapsed={isCollapsed} 
      />

      {showBackButton && (
        <SidebarBackButton 
          isCollapsed={isCollapsed} 
          onClick={handleBackClick} 
        />
      )}

      <SidebarNavigation 
        links={links} 
        isCollapsed={isCollapsed} 
      />
    </div>
  );
};

Sidebar.propTypes = {
  onCollapseChange: PropTypes.func,
};

export default Sidebar;