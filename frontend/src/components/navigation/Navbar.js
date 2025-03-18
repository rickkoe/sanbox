import React, { useContext } from "react";
import { Menu } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/navbar.css"; // ✅ Import styles
import { ConfigContext } from "../../context/ConfigContext";

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { config, loading } = useContext(ConfigContext);
  const location = useLocation();
  const isSanActive = location.pathname.startsWith("/san");
  const isStorageActive = location.pathname.startsWith("/storage");

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        
        {/* ✅ Sidebar Toggle Button */}
        <button
          className="sidebar-toggle-btn btn btn-outline-light btn-sm"
          onClick={toggleSidebar}
        >
          <Menu size={20} />
        </button>

        <NavLink className="navbar-brand ms-3 fw-bold fs-4" to="/">
          SANBox
        </NavLink>

        {/* ✅ Display Active Customer & Project (Adjust position when sidebar is open) */}
        <div className={`navbar-config d-flex gap-2 ${isSidebarOpen ? "shifted" : ""}`}>
          {loading ? (
            <span className="text-light">Loading...</span>
          ) : config ? (
            <>
              <span className=" bg-secondary">
                Customer: <strong>{config.customer?.name || "None"}</strong>
              </span>
              <span className="badge bg-secondary">
                Project: <strong>{config.active_project?.name || "None"}</strong>
              </span>
            </>
          ) : (
            <span className="text-light">No active config</span>
          )}
        </div>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto gap-2">
            <li className="nav-item">
              <NavLink className="nav-link" to="/customers">
                Customers
              </NavLink>
            </li>

            {/* SAN Dropdown */}
            <li className="nav-item dropdown">
              <Link
                className={`nav-link dropdown-toggle ${isSanActive ? "active" : ""}`}
                to="#"
                id="sanDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                SAN
              </Link>
              <ul className="dropdown-menu" aria-labelledby="sanDropdown">
                <li>
                  <NavLink className="dropdown-item" to="/san/fabrics">
                    Fabrics
                  </NavLink>
                </li>
                <li>
                  <NavLink className="dropdown-item" to="/san/aliases">
                    Aliases
                  </NavLink>
                </li>
                <li>
                  <NavLink className="dropdown-item" to="/san/zones">
                    Zones
                  </NavLink>
                </li>
              </ul>
            </li>

            {/* Storage Dropdown */}
            <li className="nav-item dropdown">
              <Link
                className={`nav-link dropdown-toggle ${isStorageActive ? "active" : ""}`}
                to="#"
                id="storageDropdown"
                role="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                Storage
              </Link>
              <ul className="dropdown-menu" aria-labelledby="storageDropdown">
                <li>
                  <NavLink className="dropdown-item" to="/storage">
                    DS8000
                  </NavLink>
                </li>
                <li>
                  <NavLink className="dropdown-item" to="/storage">
                    FlashSystem
                  </NavLink>
                </li>
              </ul>
            </li>

            <li className="nav-item">
              <NavLink className="nav-link" to="/config">
                Config
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className="nav-link" to="/tools">
                Tools
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