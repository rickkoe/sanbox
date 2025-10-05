import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Building2, FolderOpen, Settings, Shield, Edit2, Eye } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NavbarContext = ({ config, loading }) => {
  const { getUserRole } = useAuth();

  const getRoleInfo = (role) => {
    switch (role) {
      case 'admin':
        return { icon: Shield, color: '#dc3545', label: 'Admin' };
      case 'member':
        return { icon: Edit2, color: '#0d6efd', label: 'Member' };
      case 'viewer':
        return { icon: Eye, color: '#6c757d', label: 'Viewer' };
      default:
        return { icon: Eye, color: '#6c757d', label: 'Unknown' };
    }
  };

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

  const userRole = getUserRole(config.customer.id);
  const roleInfo = getRoleInfo(userRole);
  const RoleIcon = roleInfo.icon;

  return (
    <div className="navbar-context">
      <Dropdown align="start">
        <Dropdown.Toggle as="div" className="context-dropdown" style={{ cursor: "pointer" }}>
          <div className="context-indicator">
            <div className="context-icon">
              <Building2 size={16} />
            </div>
            <div className="context-text">
              <div className="context-customer">
                {config.customer.name}
                {userRole && (
                  <span
                    className="context-role-badge"
                    style={{
                      backgroundColor: `${roleInfo.color}15`,
                      color: roleInfo.color,
                      border: `1px solid ${roleInfo.color}40`,
                      marginLeft: '0.5rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <RoleIcon size={10} />
                    {roleInfo.label}
                  </span>
                )}
              </div>
              <div className="context-project">{config.active_project.name}</div>
            </div>
          </div>
        </Dropdown.Toggle>
        <Dropdown.Menu className="context-menu">
          <div className="context-menu-header">
            <small className="text-muted">Current Context</small>
          </div>
          <Dropdown.Item className="context-menu-item">
            <Building2 size={14} className="me-2" />
            <div style={{ flex: 1 }}>
              <div className="context-menu-primary">
                {config.customer.name}
                {userRole && (
                  <span
                    style={{
                      backgroundColor: `${roleInfo.color}15`,
                      color: roleInfo.color,
                      border: `1px solid ${roleInfo.color}40`,
                      marginLeft: '0.5rem',
                      padding: '0.125rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <RoleIcon size={9} />
                    {roleInfo.label}
                  </span>
                )}
              </div>
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