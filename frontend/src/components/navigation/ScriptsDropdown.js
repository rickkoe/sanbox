import React from "react";
import { NavLink } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Terminal } from "lucide-react";

const ScriptsDropdown = () => {
  return (
    <li className="nav-item">
      <Dropdown align="end">
        <Dropdown.Toggle 
          as="span" 
          className="nav-link" 
          style={{ cursor: "pointer" }}
          title="Scripts"
        >
          <Terminal size={24} />
          <span className="nav-label ms-1">Scripts</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item as={NavLink} to="/scripts/zoning">
            SAN Scripts
          </Dropdown.Item>
          <Dropdown.Item as={NavLink} to="/scripts/storage">
            Storage Scripts
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </li>
  );
};

export default ScriptsDropdown;