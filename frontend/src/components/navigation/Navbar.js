import React, { useContext, useState } from "react";
import { Menu, User, HelpCircle, Upload, Terminal, Settings, Building2, FolderOpen, ArrowLeft, Download } from "lucide-react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConfigContext } from "../../context/ConfigContext";
import { useImportStatus } from "../../context/ImportStatusContext";
import { Dropdown } from "react-bootstrap";

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { config, loading } = useContext(ConfigContext);
  const { isImportRunning, importProgress } = useImportStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const isSanActive = location.pathname.startsWith("/san");
  const isStorageActive = location.pathname.startsWith("/storage");

  // Smart back navigation logic
  const getBackPath = () => {
    const path = location.pathname;
    
    // Storage system detail -> Storage list
    if (path.match(/^\/storage\/\d+$/)) {
      return "/storage";
    }
    // Storage volumes -> Storage system detail
    if (path.match(/^\/storage\/(\d+)\/volumes$/)) {
      const storageId = path.match(/^\/storage\/(\d+)\/volumes$/)[1];
      return `/storage/${storageId}`;
    }
    // SAN sub-pages -> SAN main
    if (path.startsWith("/san/") && path !== "/san") {
      return "/san";
    }
    // Config, tools, scripts -> Home
    if (["/config", "/tools", "/scripts"].some(p => path.startsWith(p))) {
      return "/";
    }
    // Import pages -> parent section
    if (path.includes("/import")) {
      if (path.includes("/san/aliases")) return "/san/aliases";
      if (path.includes("/san/zones")) return "/san/zones";
      return "/";
    }
    
    return null; // No logical back path
  };

  const backPath = getBackPath();
  const showBackButton = backPath && location.pathname !== "/";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark ">
      <div className="container-fluid">
        <div className="navbar-left">
          {showBackButton && (
            <button 
              className="nav-back-button me-3"
              onClick={() => navigate(backPath)}
              title="Go back"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <NavLink className="navbar-brand" to="/">
            <img src="/images/logo-light.png" alt="Logo" className="logo-image" />
          </NavLink>
        </div>

        {/* Project Context Indicator */}
        <div className="navbar-context">
          {loading ? (
            <div className="context-loading">
              <span className="loading-dot"></span>
            </div>
          ) : config && config.customer ? (
            <Dropdown align="start">
              <Dropdown.Toggle as="div" className="context-dropdown" style={{ cursor: "pointer" }}>
                <div className="context-indicator">
                  <div className="context-icon">
                    <Building2 size={16} />
                  </div>
                  <div className="context-text">
                    <div className="context-customer">{config.customer.name}</div>
                    <div className="context-project">{config.active_project.name}</div>
                  </div>
                  <div className="context-chevron">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M6 9L2 5h8L6 9z"/>
                    </svg>
                  </div>
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="context-menu">
                <div className="context-menu-header">
                  <small className="text-muted">Current Context</small>
                </div>
                <Dropdown.Item className="context-menu-item">
                  <Building2 size={14} className="me-2" />
                  <div>
                    <div className="context-menu-primary">{config.customer.name}</div>
                    <small className="text-muted">Customer</small>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item className="context-menu-item">
                  <FolderOpen size={14} className="me-2" />
                  <div>
                    <div className="context-menu-primary">{config.active_project.name}</div>
                    <small className="text-muted">Active Project</small>
                  </div>
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item as={Link} to="/config">
                  <Settings size={14} className="me-2" />
                  Change Context
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <Link to="/config" className="context-empty">
              <Building2 size={16} className="me-2" />
              <span>Setup Required</span>
            </Link>
          )}
        </div>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center d-flex">
            {/* Import Button */}
            <li className="nav-item">
              <NavLink
                className="nav-link"
                to="/insights/importer"
                title={isImportRunning ? `Import Running (${Math.round((importProgress?.current || 0) / (importProgress?.total || 100) * 100)}%)` : "Data Import"}
              >
                <Download 
                  size={24} 
                  className={isImportRunning ? "import-spinning" : ""} 
                />
                <span className="nav-label ms-1">Import</span>
                {isImportRunning && (
                  <span className="import-indicator">
                    <span className="import-pulse"></span>
                  </span>
                )}
              </NavLink>
            </li>

            {/* Tools Group */}
            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle 
                  as="span" 
                  className="nav-link" 
                  style={{ cursor: "pointer" }}
                  title="Tools & Scripts"
                >
                  <Terminal size={24} />
                  <span className="nav-label ms-1">Tools</span>
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item as={NavLink} to="/customers">
                    Customers
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item as={NavLink} to="/scripts">
                    Script Builder
                  </Dropdown.Item>
                  <Dropdown.Item as={NavLink} to="/tools">
                    Calculators
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>

            <li className="nav-item nav-divider">
              <span className="divider-line"></span>
            </li>

            {/* User & Settings Group */}
            <li className="nav-item">
              <NavLink
                className="nav-link"
                to="/config"
                title="Settings"
              >
                <Settings size={24} />
                <span className="nav-label ms-1">Settings</span>
              </NavLink>
            </li>

            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle 
                  as="span" 
                  className="nav-link" 
                  style={{ cursor: "pointer" }}
                  title="Help & Admin"
                >
                  <HelpCircle size={24} />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item
                    as="a"
                    href="http://127.0.0.1:8000/admin/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Admin Panel
                    <span style={{ fontSize: "0.8em", marginLeft: "4px" }}>
                      🔗
                    </span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>

            <li className="nav-item">
              <span
                className="nav-link user-profile"
                style={{ cursor: "pointer" }}
                title="User Profile"
              >
                <User size={24} />
              </span>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;