import React, { useContext, useCallback } from "react";
import PropTypes from "prop-types";
import "bootstrap/dist/css/bootstrap.min.css";
import { ConfigContext } from "../../context/ConfigContext";
import { useImportStatus } from "../../context/ImportStatusContext";
import { useNavigation } from "../../hooks/useNavigation";
import NavbarBrand from "./NavbarBrand";
import NavbarContext from "./NavbarContext";
import ImportButton from "./ImportButton";
import ToolsDropdown from "./ToolsDropdown";
import UserSection from "./UserSection";

const Navbar = ({ toggleSidebar, isSidebarOpen }) => {
  const { config, loading } = useContext(ConfigContext);
  const { isImportRunning, importProgress, currentImport, cancelImport } = useImportStatus();
  const { backPath, showBackButton } = useNavigation();

  const handleCancelImport = useCallback(async (importId) => {
    await cancelImport(importId);
  }, [cancelImport]);

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

            <ToolsDropdown />

            <li className="nav-item nav-divider">
              <span className="divider-line"></span>
            </li>

            <UserSection />
          </ul>
        </div>
      </div>
    </nav>
  );
};

Navbar.propTypes = {
  toggleSidebar: PropTypes.func,
  isSidebarOpen: PropTypes.bool,
};

export default Navbar;