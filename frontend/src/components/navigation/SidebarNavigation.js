import React from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";

const SidebarNavigation = ({ links, isCollapsed }) => {
  return (
    <nav className="sidebar-nav">
      <ul className="sidebar-menu">
        {links.map((link) => {
          const LinkIcon = link.icon;
          return (
            <li key={link.path} className="sidebar-menu-item">
              <NavLink
                to={link.path}
                end={link.label === "Properties"}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? "active" : ""}`
                }
                title={isCollapsed ? link.label : ""}
              >
                {LinkIcon && (
                  <div className="sidebar-link-icon">
                    <LinkIcon size={18} />
                  </div>
                )}
                {!isCollapsed && (
                  <span className="sidebar-link-text">{link.label}</span>
                )}
                {!isCollapsed && (
                  <div className="sidebar-link-indicator"></div>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

SidebarNavigation.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
    })
  ).isRequired,
  isCollapsed: PropTypes.bool.isRequired,
};

export default SidebarNavigation;