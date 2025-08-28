import React from "react";
import { NavLink } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Terminal, Info } from "lucide-react";

const ToolsDropdown = ({ onAboutClick }) => {
  return (
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
          <Dropdown.Item as={NavLink} to="/scripts">
            Script Builder
          </Dropdown.Item>
          <Dropdown.Item as={NavLink} to="/tools">
            Calculators
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={onAboutClick}>
            <Info size={16} className="me-2" />
            About
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </li>
  );
};

export default ToolsDropdown;