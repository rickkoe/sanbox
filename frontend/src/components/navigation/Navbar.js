import React, { useContext, useState } from "react";
import { Menu, User, HelpCircle, Upload, Terminal, Settings } from "lucide-react";
import { NavLink, Link, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConfigContext } from "../../context/ConfigContext";
import { Dropdown } from "react-bootstrap";

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
                <a
                  href="/config"
                  className="text-light"
                  title="Active Project"
                  rel="noopener noreferrer"
                >
                  {config.customer.name}:  {config.active_project.name}
                </a>
              </span>
            </div>
          ) : (
            <span className="text-light">No active customer</span>
          )}
        </div>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto gap-3 align-items-center d-flex">
          <li className="nav-item">

              <NavLink
                className="nav-link"
                to="/scripts"
                title="Import Data"
              >
                <Terminal size={28} />
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                className="nav-link"
                to="/insights/importer"
                title="Import Data"
              >
                <Upload size={28} />
              </NavLink>
            </li>

            <li className="nav-item">
              <span
                className="nav-link"
                style={{ cursor: "pointer" }}
                title="User Panel"
              >
                <User size={28} />
              </span>
            </li>
            <li className="nav-item">
                <NavLink
                className="nav-link"
                to="/config"
                title="Config"
              >
                <Settings size={28} />
              </NavLink>
            </li>
            <li className="nav-item">
              <Dropdown align="end">
                <Dropdown.Toggle as="span" style={{ cursor: "pointer" }}>
                  <HelpCircle size={28} />
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item as={NavLink} to="/config">
                    Config
                  </Dropdown.Item>
                  <Dropdown.Item
                    as="a"
                    href="http://127.0.0.1:8000/admin/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Admin{" "}
                    <span style={{ fontSize: "0.8em", marginLeft: "4px" }}>
                      🔗
                    </span>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;