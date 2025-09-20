import React, { useState, useCallback, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import "./Sidebar.css";
import { useSidebarConfig } from "../../hooks/useSidebarConfig";
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import SidebarHeader from "./SidebarHeader";
import SidebarBackButton from "./SidebarBackButton";
import SidebarNavigation from "./SidebarNavigation";

const Sidebar = ({ isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();
  const { icon, links, showBackButton, backPath, dynamicHeader } = useSidebarConfig();

  const handleToggle = useCallback(() => {
    if (onCollapseChange) {
      onCollapseChange(!isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  const handleBackClick = useCallback(() => {
    if (backPath) {
      navigate(backPath);
    } else if (location.pathname.startsWith("/storage")) {
      navigate("/storage/systems");
    } else {
      navigate("/");
    }
  }, [backPath, location.pathname, navigate]);

  return (
    <div className={`modern-sidebar theme-${theme} ${isCollapsed ? 'collapsed' : ''}`}>
      
      <SidebarHeader 
        icon={icon} 
        title={dynamicHeader} 
        isCollapsed={isCollapsed}
        onToggle={handleToggle}
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
  isCollapsed: PropTypes.bool.isRequired,
  onCollapseChange: PropTypes.func,
};

export default Sidebar;