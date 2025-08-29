import React, { useState } from "react";
import PropTypes from "prop-types";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";

const SidebarNavigation = ({ links, isCollapsed }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState(() => {
    // Auto-expand sections based on current path
    const initialExpanded = {};
    links.forEach((link, index) => {
      if (link.expandable && link.subLinks) {
        // Check if any sublink matches current path
        const isCurrentSection = link.subLinks.some(subLink => 
          location.pathname.startsWith(subLink.path)
        );
        initialExpanded[index] = isCurrentSection;
      }
    });
    return initialExpanded;
  });

  const toggleSection = (index) => {
    if (isCollapsed) return; // Don't toggle when collapsed
    
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const renderLink = (link, key) => {
    const LinkIcon = link.icon;
    return (
      <li key={key} className="sidebar-menu-item">
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
  };

  const renderExpandableSection = (section, index) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedSections[index];
    
    return (
      <li key={`section-${index}`} className="sidebar-menu-item">
        <div
          className={`sidebar-link sidebar-section-header ${isExpanded ? 'expanded' : ''}`}
          onClick={() => toggleSection(index)}
          title={isCollapsed ? section.label : ""}
          style={{ cursor: isCollapsed ? 'default' : 'pointer' }}
        >
          {SectionIcon && (
            <div className="sidebar-link-icon">
              <SectionIcon size={18} />
            </div>
          )}
          {!isCollapsed && (
            <>
              <span className="sidebar-link-text">{section.label}</span>
              <div className="sidebar-section-toggle">
                {isExpanded ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </div>
            </>
          )}
        </div>
        
        {!isCollapsed && isExpanded && (
          <ul className="sidebar-submenu">
            {section.subLinks.map((subLink) => (
              <li key={subLink.path} className="sidebar-submenu-item">
                <NavLink
                  to={subLink.path}
                  className={({ isActive }) =>
                    `sidebar-sublink ${isActive ? "active" : ""}`
                  }
                >
                  {subLink.icon && (
                    <div className="sidebar-sublink-icon">
                      <subLink.icon size={16} />
                    </div>
                  )}
                  <span className="sidebar-sublink-text">{subLink.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav className="sidebar-nav">
      <ul className="sidebar-menu">
        {links.map((link, index) => {
          if (link.expandable) {
            return renderExpandableSection(link, index);
          } else {
            return renderLink(link, link.path);
          }
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