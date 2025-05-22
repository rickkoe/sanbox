import React, { useContext } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ConfigContext } from "../../context/ConfigContext";

const getSidebarLinks = (pathname) => {
  if (pathname.startsWith("/san")) {
    return {
      header: "SAN",
      showBackButton: true,
      links: [
        { path: "/san/fabrics", label: "Fabrics" },
        { path: "/san/aliases", label: "Aliases" },
        { path: "/san/zones", label: "Zones" },
      ],
    };
  }

  if (pathname.startsWith("/storage")) {
    const storageIdMatch = pathname.match(/^\/storage\/(\d+)/);
    if (storageIdMatch) {
      return {
        header: "Storage System",
        showBackButton: true,
        links: [
          { path: `/storage/${storageIdMatch[1]}`, label: "Overview" },
          { path: `/storage/${storageIdMatch[1]}/volumes`, label: "Volumes" },
        ],
      };
    }

    return {
      header: "Storage",
      showBackButton: true,
      links: [
        { path: "/storage", label: "Storage" },
        { path: "/storage/ds8000", label: "DS8000" },
        { path: "/storage/flashsystem", label: "FlashSystem" },
        { path: "/storage/volumes", label: "Volumes" },
      ],
    };
  }

  return {
    header: "General",
    showBackButton: false,
    links: [
      { path: "/", label: "Home" },
      { path: "/customers", label: "Customers" },
      { path: "/san", label: "SAN" },
      { path: "/storage", label: "Storage" },
      { path: "/tools", label: "Tools" },
    ],
  };
};

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { header, links, showBackButton } = getSidebarLinks(location.pathname);
  const { config, loading, activeStorageSystem } = useContext(ConfigContext);

  const dynamicHeader =
    location.pathname.startsWith("/storage/") && activeStorageSystem?.name
      ? activeStorageSystem.name
      : header;

  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-content">
          {config && config.customer && (
            <div className="active-customer-card text-white rounded shadow">
              <p className="mb-0">{dynamicHeader}</p>
            </div>
          )}
          {showBackButton && (
            <button
              className="sidebar-back-button"
              onClick={() =>
                location.pathname.startsWith("/storage")
                  ? navigate("/storage")
                  : navigate("/")
              }
            >
              <span className="arrow">←</span> Back
            </button>
          )}
          <ul>
            {links.map((link) => (
              <li key={link.path}>
                <NavLink
                  to={link.path}
                  end={link.label === "Overview"}
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;