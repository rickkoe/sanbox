import React from "react";
import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

const NavbarBrand = () => {
  const { theme } = useTheme();

  // Use light logo for dark navbars (dark, light, corporate) and dark logo for light navbars (modern, minimal, colorful)
  const logoSrc = theme === 'dark' || theme === 'light' || theme === 'corporate'
    ? "/images/logo-light.png"
    : "/images/logo-dark.png";

  return (
    <NavLink className="navbar-brand" to="/">
      <img src={logoSrc} alt="Logo" className="logo-image" />
    </NavLink>
  );
};

export default NavbarBrand;