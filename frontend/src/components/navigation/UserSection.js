import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Settings, HelpCircle, User, Sliders, Info } from "lucide-react";

const UserSection = ({ onAboutClick }) => {
  const location = useLocation();
  const isSettingsActive = location.pathname.startsWith('/settings');
  
  return (
    <>
      <li className="nav-item">
        <Dropdown align="end">
          <Dropdown.Toggle 
            as="span" 
            className={`nav-link ${isSettingsActive ? 'active' : ''}`}
            style={{ cursor: "pointer" }}
            title="Settings & Configuration"
          >
            <Settings size={24} />
            <span className="nav-label ms-1">Settings</span>
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
            <HelpCircle size={24} />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={onAboutClick}>
              <Info size={16} className="me-2" />
              About
            </Dropdown.Item>
            <Dropdown.Divider />
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
    </>
  );
};

export default UserSection;