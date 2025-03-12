import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "../../styles/sidebar.css";
import { useSanVendor } from "../../context/SanVendorContext";
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

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const { header, links } = getSidebarLinks(location.pathname);
  const { sanVendor, updateSanVendor } = useSanVendor();

  return (
    <div className={`sidebar bg-dark ${isOpen ? "open" : "closed"}`}>
      <h6 className="sidebar-header text-light px-3 pt-3">{header}</h6>
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