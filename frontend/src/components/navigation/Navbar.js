import React, { useContext, useCallback, useState } from "react";
import PropTypes from "prop-types";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Navbar.css";
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import { useNavigation } from "../../hooks/useNavigation";
import NavbarBrand from "./NavbarBrand";
import NavbarContext from "./NavbarContext";
import UserSection from "./UserSection";
import AboutModal from "../../pages/AboutPage";

const Navbar = () => {
  const { config, loading } = useContext(ConfigContext);
  const { theme } = useTheme();
  const { backPath, showBackButton } = useNavigation();
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleAboutClick = useCallback(() => {
    setShowAboutModal(true);
  }, []);

  console.log('Navbar theme class:', `navbar navbar-expand-lg theme-${theme}`);
  
  return (
    <nav className={`navbar navbar-expand-lg theme-${theme}`}>
      <div className="container-fluid">
        <NavbarBrand 
          showBackButton={showBackButton} 
          backPath={backPath} 
        />

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