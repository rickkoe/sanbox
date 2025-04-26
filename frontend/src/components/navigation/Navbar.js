import React, { useContext } from "react";
import { Menu } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConfigContext } from "../../context/ConfigContext";

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { config, loading } = useContext(ConfigContext);
  const location = useLocation();
  const isSanActive = location.pathname.startsWith("/san");
  const isStorageActive = location.pathname.startsWith("/storage");

  return (
    <nav className="navbar navbar-expand-lg navbar-dark ">
      <div className="container-fluid">
        

        <NavLink className="navbar-brand ms-3" to="/">
          <img src="/images/logo-light.png" alt="Logo" className="logo-image" />
        </NavLink>

        {/* ✅ Display Active Project */}
        <div className={`navbar-config ${isSidebarOpen ? "shifted" : ""}`}>
          {loading ? (
            <span className="text-light">Loading...</span>
          ) : config && config.customer ? (
            <div className="active-project-card p-2 rounded">
              <span className="active-project">
                <a href={`https://insights.ibm.com/cui/${config.customer.insights_tenant}`} target="_blank" rel="noopener noreferrer">
                  {config.customer.name}
                </a>
              </span>
            </div>
          ) : (
            <span className="text-light">No active customer</span>
          )}
        </div>


        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto gap-2">

            <li className="nav-item">
              <NavLink className="nav-link" to="/config">
                Config
              </NavLink>
            </li>

            {/* ✅ Django Admin Link (Opens in a New Tab) */}
            <li className="nav-item">
              <a
                className="nav-link"
                href="http://127.0.0.1:8000/admin/"
                target="_blank"
                rel="noopener noreferrer"
                title="Open Django Admin in a new tab"
              >
                Admin
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;