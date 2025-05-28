import React, { useContext } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BreadcrumbContext } from "../../context/BreadcrumbContext";

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
          { path: `/storage/${storageIdMatch[1]}`, label: "Properties" },
          { path: `/storage/${storageIdMatch[1]}/volumes`, label: "Volumes" },
        ],
      };
    }

    return {
      header: "Storage",
      showBackButton: true,
      links: [
        { path: "/storage", label: "Storage" },
      ],
    };
  }

  if (pathname.startsWith("/scripts")) {
    return {
      header: "Script Builder",
      showBackButton: true,
      links: [
        { path: "/scripts/ds8000", label: "DS8000" },
        { path: "/scripts/flashsystem", label: "FlashSystem" },
        { path: "/scripts/zoning", label: "SAN Zoning" },
      ],
    };
  }

  return {
    header: "General",
    showBackButton: false,
    links: [
      { path: "/san", label: "SAN" },
      { path: "/storage", label: "Storage" },
      { path: "/customers", label: "Customers" },
      { path: "/tools", label: "Tools" },
    ],
  };
};

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { header, links, showBackButton } = getSidebarLinks(location.pathname);
  const storageIdMatch = location.pathname.match(/^\/storage\/(\d+)/);

  const { breadcrumbMap } = useContext(BreadcrumbContext);

  const dynamicHeader =
    location.pathname.startsWith("/storage/") && storageIdMatch
      ? breadcrumbMap[storageIdMatch[1]] || `Storage ${storageIdMatch[1]}`
      : header;

  return (
    <div className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-content">
          {dynamicHeader && (
            <div className="active-customer-card text-white rounded shadow">
              <p
                className="mb-0 text-truncate storage-name-tooltip"
                title={dynamicHeader}
                style={{
                  fontSize: "clamp(0.4rem, 1.2vw, 1rem)",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
              >
                {dynamicHeader}
              </p>
            </div>
          )}
          {showBackButton && (
            <button
              className="sidebar-back-button"
              onClick={() => {
                const isSpecificStoragePage =
                  location.pathname.match(/^\/storage\/\d+/);
                if (isSpecificStoragePage) {
                  navigate("/storage");
                } else if (location.pathname.startsWith("/storage")) {
                  navigate("/");
                } else {
                  navigate("/");
                }
              }}
            >
              <span className="arrow">←</span> Back
            </button>
          )}
          <ul>
            {links.map((link, index) =>
              link.divider ? (
                <hr key={`divider-${index}`} className="sidebar-divider" />
              ) : (
                <li key={link.path}>
                  <NavLink
                    to={link.path}
                    end={link.label === "Properties"}
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;