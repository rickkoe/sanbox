import React, { useContext, useCallback, useState } from "react";
import PropTypes from "prop-types";
import "bootstrap/dist/css/bootstrap.min.css";
// Navbar styles are now in styles/navbar.css
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import NavbarBrand from "./NavbarBrand";
import NavbarContext from "./NavbarContext";
import UserSection from "./UserSection";
import AboutModal from "../../pages/AboutPage";

const Navbar = () => {
  const { config, loading } = useContext(ConfigContext);
  const { theme } = useTheme();
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleAboutClick = useCallback(() => {
    setShowAboutModal(true);
  }, []);

  // Debug theme application
  console.log('Navbar theme class:', `navbar navbar-expand-lg theme-${theme}`);
  
  return (
    <nav className={`navbar navbar-expand-lg theme-${theme}`}>
      <div className="container-fluid">
        <NavbarBrand />

        <NavbarContext 
          config={config} 
          loading={loading} 
        />

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center d-flex">
            <UserSection onAboutClick={handleAboutClick} />
          </ul>
        </div>
      </div>
      <AboutModal 
        show={showAboutModal} 
        onHide={() => setShowAboutModal(false)} 
      />
    </nav>
  );
};


export default Navbar;