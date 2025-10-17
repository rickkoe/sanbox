import React, { useState, useCallback, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { useSidebarConfig } from "../../hooks/useSidebarConfig";
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import SidebarHeader from "./SidebarHeader";
import SidebarNavigation from "./SidebarNavigation";

const Sidebar = ({ isCollapsed, onCollapseChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { config } = useContext(ConfigContext);
  const { theme } = useTheme();
  const { icon, links, dynamicHeader, showBackButton, backPath, showHeaderInNav } = useSidebarConfig();

  const handleToggle = useCallback(() => {
    if (onCollapseChange) {
      onCollapseChange(!isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  console.log('Sidebar theme class:', `modern-sidebar theme-${theme} ${isCollapsed ? 'collapsed' : ''}`);

  return (
    <div className={`modern-sidebar theme-${theme} ${isCollapsed ? 'collapsed' : ''}`}>

      <SidebarHeader
        icon={icon}
        title={showHeaderInNav ? "" : dynamicHeader}
        isCollapsed={isCollapsed}
        onToggle={handleToggle}
        showBackButton={showBackButton}
        backPath={backPath}
      />

      <div className="sidebar-navigation">
        <SidebarNavigation
          links={links}
          isCollapsed={isCollapsed}
          headerTitle={showHeaderInNav ? dynamicHeader : null}
        />
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  isCollapsed: PropTypes.bool.isRequired,
  onCollapseChange: PropTypes.func,
};

export default Sidebar;