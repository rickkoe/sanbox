import React, { useContext, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BreadcrumbContext } from "../../context/BreadcrumbContext";
import { 
  Network, 
  HardDrive, 
  ChevronLeft, 
  ChevronRight,
  Menu,
  GitBranch,
  Tags,
  Layers,
  Server,
  Archive
} from "lucide-react";

const getSidebarLinks = (pathname) => {
  if (pathname.startsWith("/san")) {
    return {
      header: "SAN Management",
      icon: Network,
      showBackButton: false,
      links: [
        { path: "/san/fabrics", label: "Fabrics", icon: GitBranch },
        { path: "/san/aliases", label: "Aliases", icon: Tags },
        { path: "/san/zones", label: "Zones", icon: Layers },
      ],
    };
  }

  if (pathname.startsWith("/storage")) {
    const storageIdMatch = pathname.match(/^\/storage\/(\d+)/);
    if (storageIdMatch) {
      return {
        header: "Storage System",
        icon: Server,
        showBackButton: true,
        backPath: "/storage",
        links: [
          { path: `/storage/${storageIdMatch[1]}`, label: "Properties", icon: Server },
          { path: `/storage/${storageIdMatch[1]}/volumes`, label: "Volumes", icon: Archive },
        ],
      };
    }

    return {
      header: "Storage Management",
      icon: HardDrive,
      showBackButton: false,
      links: [
        { path: "/storage", label: "Systems", icon: Server },
      ],
    };
  }

  // Default sidebar - simplified to only SAN and Storage
  return {
    header: "Main Menu",
    icon: Menu,
    showBackButton: false,
    links: [
      { path: "/san", label: "SAN", icon: Network },
      { path: "/storage", label: "Storage", icon: HardDrive },
    ],
  };
};

const Sidebar = ({ onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { header, icon: HeaderIcon, links, showBackButton, backPath } = getSidebarLinks(location.pathname);
  const storageIdMatch = location.pathname.match(/^\/storage\/(\d+)/);

  const { breadcrumbMap } = useContext(BreadcrumbContext);

  const dynamicHeader =
    location.pathname.startsWith("/storage/") && storageIdMatch
      ? breadcrumbMap[storageIdMatch[1]] || `Storage ${storageIdMatch[1]}`
      : header;

  const handleBackClick = () => {
    if (backPath) {
      navigate(backPath);
    } else if (location.pathname.startsWith("/storage")) {
      navigate("/");
    } else {
      navigate("/");
    }
  };

  return (
    <div className={`modern-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Collapse Toggle */}
      <button 
        className="sidebar-toggle"
        onClick={() => {
          const newCollapsedState = !isCollapsed;
          setIsCollapsed(newCollapsedState);
          onCollapseChange?.(newCollapsedState);
        }}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Header */}
      <div className="sidebar-header">
        {HeaderIcon && (
          <div className="sidebar-header-icon">
            <HeaderIcon size={isCollapsed ? 20 : 24} />
          </div>
        )}
        {!isCollapsed && (
          <div className="sidebar-header-content">
            <h3 className="sidebar-title">{dynamicHeader}</h3>
          </div>
        )}
      </div>

      {/* Back Button */}
      {showBackButton && (
        <button
          className="sidebar-back-button"
          onClick={handleBackClick}
          title="Go back"
        >
          <ChevronLeft size={16} />
          {!isCollapsed && <span>Back</span>}
        </button>
      )}

      {/* Navigation Menu */}
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
    </div>
  );
};

export default Sidebar;