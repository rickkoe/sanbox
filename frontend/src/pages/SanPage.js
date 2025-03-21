import React from "react";
import { FaDatabase } from "react-icons/fa"; // Import icons from react-icons

const SanPage = () => {
  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">SAN Tables</h1>
      
      <div className="tools-grid">
        <a href="/san/fabrics" className="tool-card">
          <FaDatabase className="tool-icon" />
          <span>Fabrics</span>
        </a>

        <a href="/san/aliases" className="tool-card">
          <FaDatabase className="tool-icon" />
          <span>Aliases</span>
        </a>
        <a href="/san/zones" className="tool-card">
          <FaDatabase className="tool-icon" />
          <span>Zones</span>
        </a>
      </div>
    </div>
  );
};

export default SanPage;
