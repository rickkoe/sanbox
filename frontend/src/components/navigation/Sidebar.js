import React, { useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSanVendor } from "../../context/SanVendorContext";
import { ConfigContext } from "../../context/ConfigContext";
import { motion } from "framer-motion";

const getSidebarLinks = (pathname) => {
  if (pathname.startsWith("/san")) {
    return {
      header: "SAN Management",
      links: [
        { path: "/san/fabrics", label: "Fabrics" },
        { path: "/san/aliases", label: "Aliases" },
        { path: "/san/zones", label: "Zones" },
      ],
    };
  }

  if (pathname.startsWith("/storage")) {
    return {
      header: "Storage",
      links: [
        { path: "/storage/ds8000", label: "DS8000" },
        { path: "/storage/flashsystem", label: "FlashSystem" },
      ],
    };
  }

  return {
    header: "General",
    links: [
      { path: "/", label: "Home" },
      { path: "/customers", label: "Customers" },
      { path: "/san", label: "SAN" },
      { path: "/storage", label: "Storage" },
      { path: "/config", label: "Configuration" },
      { path: "/tools", label: "Tools" },
    ],
  };
};

const Sidebar = () => {
  const location = useLocation();
  const { header, links } = getSidebarLinks(location.pathname);
  const { sanVendor, updateSanVendor } = useSanVendor();
  const { config, loading } = useContext(ConfigContext);

  return (
    <div className="sidebar">
      {config && config.customer && (
        <div className="active-customer-card text-white rounded shadow">
          <p className="mb-0">{config.active_project.name}</p>
        </div>
      )}
      <ul>
        {links.map((link) => (
          <li key={link.path}>
            <NavLink
              to={link.path}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>

      {location.pathname.startsWith("/san") && sanVendor && (
        <div
          className={`toggle-switch ${sanVendor}`}
          onClick={() => updateSanVendor(sanVendor === "BR" ? "CI" : "BR")}
        >
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="toggle-thumb"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "50%",
              backgroundColor: "#0d6efd",
              borderRadius: "4rem",
              transform: sanVendor === "BR" ? "translateX(0%)" : "translateX(100%)",
            }}
          />
          <span className={`toggle-label ${sanVendor === "BR" ? "text-light" : "text-muted"}`}>
            Brocade
          </span>
          <span className={`toggle-label ${sanVendor === "CI" ? "text-light" : "text-muted"}`}>
            Cisco
          </span>
        </div>
      )}
    </div>
  );
};

export default Sidebar;