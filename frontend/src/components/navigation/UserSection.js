import React from "react";
import { NavLink } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Settings, HelpCircle, User } from "lucide-react";

const UserSection = () => {
  return (
    <>
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
    </>
  );
};

export default UserSection;