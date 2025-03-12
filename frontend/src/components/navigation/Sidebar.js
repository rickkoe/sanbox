import React from "react";
import { Link } from "react-router-dom";
import "../../styles/sidebar.css"; // ✅ Import styles

const Sidebar = ({ isOpen }) => {
    return (
        <div className={`sidebar ${isOpen ? "open" : "closed"}`}>
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/customers">Customers</Link></li>
                <li><Link to="/san">SAN Management</Link></li>
                <li><Link to="/storage">Storage</Link></li>
                <li><Link to="/config">Configuration</Link></li>
            </ul>
        </div>
    );
};

export default Sidebar;