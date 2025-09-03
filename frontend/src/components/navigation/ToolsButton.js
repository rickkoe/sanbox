import React from "react";
import { NavLink } from "react-router-dom";
import { Calculator } from "lucide-react";

const ToolsButton = () => {
  return (
    <li className="nav-item">
      <NavLink 
        to="/tools" 
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        title="Tools & Calculators"
      >
        <Calculator size={24} />
        <span className="nav-label ms-1">Tools</span>
      </NavLink>
    </li>
  );
};

export default ToolsButton;