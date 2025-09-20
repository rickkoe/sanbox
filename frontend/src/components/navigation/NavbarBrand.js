import React from "react";
import PropTypes from "prop-types";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const NavbarBrand = ({ showBackButton, backPath }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Use dark logo for light themes (modern, minimal, colorful) and light logo for dark themes (dark, corporate)
  const logoSrc = theme === 'dark' || theme === 'corporate' 
    ? "/images/logo-light.png" 
    : "/images/logo-dark.png";

  return (
    <div className="navbar-left">
      <div className="nav-back-container me-3">
        {showBackButton ? (
          <button 
            className="nav-back-button"
            onClick={() => navigate(backPath)}
            title="Go back"
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <div className="nav-back-spacer"></div>
        )}
      </div>
      <NavLink className="navbar-brand" to="/">
        <img src={logoSrc} alt="Logo" className="logo-image" />
      </NavLink>
    </div>
  );
};

NavbarBrand.propTypes = {
  showBackButton: PropTypes.bool,
  backPath: PropTypes.string,
};

NavbarBrand.defaultProps = {
  showBackButton: false,
  backPath: null,
};

export default NavbarBrand;