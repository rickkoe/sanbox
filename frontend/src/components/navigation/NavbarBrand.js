import React from "react";
import PropTypes from "prop-types";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const NavbarBrand = ({ showBackButton, backPath }) => {
  const navigate = useNavigate();

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
        <img src="/images/logo-light.png" alt="Logo" className="logo-image" />
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