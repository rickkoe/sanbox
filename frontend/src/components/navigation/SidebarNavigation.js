import React, { useState, useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";

const SidebarNavigation = ({ links, isCollapsed, headerTitle }) => {
  const location = useLocation();
  const popoverRef = useRef(null);
  
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

  const [hoveredSection, setHoveredSection] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 70 });
  const [hoverTimeout, setHoverTimeout] = useState(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setHoveredSection(null);
      }
    };

    if (hoveredSection !== null) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [hoveredSection]);

  const toggleSection = (index, event) => {
    if (isCollapsed) {
      // When collapsed, show popover instead of expanding
      if (hoveredSection === index) {
        setHoveredSection(null);
        return;
      }
      
      // Calculate position of the clicked element
      const rect = event.currentTarget.getBoundingClientRect();
      setPopoverPosition({
        top: rect.top,
        left: 70
      });
      setHoveredSection(index);
      return;
    }
    
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
    const isPopoverVisible = isCollapsed && hoveredSection === index;
    
    // Check if any sublink matches current path to determine if parent should be active
    const isParentActive = section.subLinks && section.subLinks.some(subLink => {
      // Exact match for root path to avoid matching everything
      if (subLink.path === "/") {
        return location.pathname === "/";
      }
      // For other paths, check if current path starts with the sublink path
      return location.pathname.startsWith(subLink.path) || location.pathname === subLink.path;
    });
    
    return (
      <li key={`section-${index}`} className="sidebar-menu-item sidebar-section">
        <div
          className={`sidebar-link sidebar-section-header ${isExpanded ? 'expanded' : ''} ${isParentActive ? 'active' : ''}`}
          onClick={(e) => toggleSection(index, e)}
          onMouseEnter={(e) => {
            if (isCollapsed) {
              if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                setHoverTimeout(null);
              }
              const rect = e.currentTarget.getBoundingClientRect();
              setPopoverPosition({
                top: rect.top,
                left: 70
              });
              setHoveredSection(index);
            }
          }}
          onMouseLeave={() => {
            if (isCollapsed) {
              const timeout = setTimeout(() => {
                setHoveredSection(null);
              }, 300);
              setHoverTimeout(timeout);
            }
          }}
          title={isCollapsed ? section.label : ""}
          style={{ cursor: 'pointer' }}
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
        
        {/* Regular submenu for expanded sidebar */}
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
    <>
      <nav className="sidebar-nav">
        {/* Display storage system name at the top if provided */}
        {headerTitle && !isCollapsed && (
          <div className="sidebar-nav-header">
            <h3 className="sidebar-nav-header-title">{headerTitle}</h3>
          </div>
        )}
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
      
      {/* Portal popover for collapsed sidebar */}
      {isCollapsed && hoveredSection !== null && links[hoveredSection]?.subLinks && createPortal(
        <div 
          className="sidebar-popover" 
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPosition.top}px`,
            left: `${popoverPosition.left}px`,
            zIndex: 10000
          }}
          onMouseEnter={() => {
            if (hoverTimeout) {
              clearTimeout(hoverTimeout);
              setHoverTimeout(null);
            }
          }}
          onMouseLeave={() => {
            const timeout = setTimeout(() => {
              setHoveredSection(null);
            }, 100);
            setHoverTimeout(timeout);
          }}
        >
          <div className="sidebar-popover-header">{links[hoveredSection]?.label}</div>
          <ul className="sidebar-popover-menu">
            {links[hoveredSection]?.subLinks?.map((subLink) => (
              <li key={subLink.path}>
                <NavLink
                  to={subLink.path}
                  className={({ isActive }) =>
                    `sidebar-popover-link ${isActive ? "active" : ""}`
                  }
                  onClick={() => setHoveredSection(null)}
                >
                  {subLink.icon && (
                    <div className="sidebar-popover-icon">
                      <subLink.icon size={16} />
                    </div>
                  )}
                  <span>{subLink.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </>
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
  headerTitle: PropTypes.string,
};

export default SidebarNavigation;