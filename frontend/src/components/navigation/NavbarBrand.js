import React from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const NavbarBrand = () => {
  const { theme } = useTheme();

  // Use dark logo for light themes (modern, minimal, colorful) and light logo for dark themes (dark, corporate)
  const logoSrc = theme === 'dark' || theme === 'corporate' 
    ? "/images/logo-light.png" 
    : "/images/logo-dark.png";

  return (
    <NavLink className="navbar-brand" to="/">
      <img src={logoSrc} alt="Logo" className="logo-image" />
    </NavLink>
  );
};

export default NavbarBrand;