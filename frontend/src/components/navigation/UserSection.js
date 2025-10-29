import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Settings, HelpCircle, User, Sliders, Info, LogOut, Database, BookOpen, Activity } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../../context/AuthContext";

const UserSection = ({ onAboutClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isSettingsActive = location.pathname.startsWith('/settings');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      <ThemeToggle />

      <li className="nav-item">
        <Dropdown align="end">
          <Dropdown.Toggle
            as="span"
            className={`nav-link ${isSettingsActive ? 'active' : ''}`}
            style={{ cursor: "pointer" }}
            title="Settings & Configuration"
          >
            <Settings size={18} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as={NavLink} to="/settings/project-config">
              <Sliders size={16} className="me-2" />
              Project Config
            </Dropdown.Item>
            <Dropdown.Item as={NavLink} to="/settings/app-settings">
              <Settings size={16} className="me-2" />
              App Settings
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item as={NavLink} to="/settings/backups">
              <Database size={16} className="me-2" />
              Backup & Restore
            </Dropdown.Item>
            <Dropdown.Item as={NavLink} to="/audit-log">
              <Activity size={16} className="me-2" />
              Activity Log
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </li>

      <li className="nav-item">
        <Dropdown align="end">
          <Dropdown.Toggle
            as="span"
            className="nav-link"
            style={{ cursor: "pointer" }}
            title="Help & Admin"
          >
            <HelpCircle size={18} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as={NavLink} to="/manual">
              <BookOpen size={16} className="me-2" />
              User Manual
            </Dropdown.Item>
            <Dropdown.Item onClick={onAboutClick}>
              <Info size={16} className="me-2" />
              About
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              as="a"
              href="/admin/"
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
        <Dropdown align="end">
          <Dropdown.Toggle
            as="span"
            className="nav-link"
            style={{ cursor: "pointer" }}
            title={user ? user.username : "User Profile"}
          >
            <User size={18} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {user && (
              <>
                <Dropdown.Header>
                  <div className="d-flex align-items-center">
                    <User size={16} className="me-2" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{user.username}</div>
                      <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{user.email}</div>
                    </div>
                  </div>
                </Dropdown.Header>
                <Dropdown.Divider />
                <Dropdown.Item as={NavLink} to="/profile">
                  <User size={16} className="me-2" />
                  My Profile
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <LogOut size={16} className="me-2" />
                  Logout
                </Dropdown.Item>
              </>
            )}
          </Dropdown.Menu>
        </Dropdown>
      </li>
    </>
  );
};

export default UserSection;