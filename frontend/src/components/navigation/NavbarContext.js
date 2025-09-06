import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Building2, FolderOpen, Settings } from "lucide-react";

const NavbarContext = ({ config, loading }) => {
  if (loading) {
    return (
      <div className="navbar-context">
        <div className="context-loading">
          <span className="loading-dot"></span>
        </div>
      </div>
    );
  }

  if (!config || !config.customer || !config.active_project) {
    return (
      <div className="navbar-context">
        <Link to="/settings/project-config" className="context-empty">
          <Building2 size={16} className="me-2" />
          <span>Setup Required</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="navbar-context">
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
          <Dropdown.Item as={Link} to="/settings/project-config">
            <Settings size={14} className="me-2" />
            Change Context
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

NavbarContext.propTypes = {
  config: PropTypes.shape({
    customer: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
    active_project: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  }),
  loading: PropTypes.bool.isRequired,
};

export default NavbarContext;