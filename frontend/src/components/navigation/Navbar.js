import React, { useContext, useCallback, useState } from "react";
import PropTypes from "prop-types";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConfigContext } from "../../context/ConfigContext";
import { useImportStatus } from "../../context/ImportStatusContext";
import { useNavigation } from "../../hooks/useNavigation";
import NavbarBrand from "./NavbarBrand";
import NavbarContext from "./NavbarContext";
import ImportButton from "./ImportButton";
import ScriptsDropdown from "./ScriptsDropdown";
import ToolsDropdown from "./ToolsDropdown";
import UserSection from "./UserSection";
import AboutModal from "../../pages/AboutPage";

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { config, loading } = useContext(ConfigContext);
  const { isImportRunning, importProgress, currentImport, cancelImport } = useImportStatus();
  const { backPath, showBackButton } = useNavigation();
  const [showAboutModal, setShowAboutModal] = useState(false);

  const handleCancelImport = useCallback(async (importId) => {
    await cancelImport(importId);
  }, [cancelImport]);

  const handleAboutClick = useCallback(() => {
    setShowAboutModal(true);
  }, []);

  return (
    <nav className="navbar navbar-expand-lg navbar-dark">
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
            <ImportButton 
              isImportRunning={isImportRunning}
              importProgress={importProgress}
              currentImport={currentImport}
              onCancelImport={handleCancelImport}
            />

            <ScriptsDropdown />
            
            <ToolsDropdown />

            <li className="nav-item nav-divider">
              <span className="divider-line"></span>
            </li>

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

Navbar.propTypes = {
  toggleSidebar: PropTypes.func,
  isSidebarOpen: PropTypes.bool,
};

export default Navbar;