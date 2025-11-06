import React, { useContext, useCallback, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
// Navbar styles are now in styles/navbar.css
import { ConfigContext } from "../../context/ConfigContext";
import { useTheme } from "../../context/ThemeContext";
import NavbarBrand from "./NavbarBrand";
import DualContextDropdown from "./DualContextDropdown";
import UserSection from "./UserSection";
import AboutModal from "../../pages/AboutPage";
import axios from "axios";

const Navbar = () => {
  const { config, loading } = useContext(ConfigContext);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [activeImportsCount, setActiveImportsCount] = useState(0);

  const handleAboutClick = useCallback(() => {
    setShowAboutModal(true);
  }, []);

  // Fetch active imports count
  const fetchActiveImportsCount = useCallback(async () => {
    try {
      const response = await axios.get('/api/importer/active-imports-count/');
      setActiveImportsCount(response.data.count || 0);
    } catch (err) {
      // Silently fail - don't show errors for this
      console.error('Failed to fetch active imports count:', err);
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchActiveImportsCount();
    const interval = setInterval(fetchActiveImportsCount, 10000); // 10 seconds
    return () => clearInterval(interval);
  }, [fetchActiveImportsCount]);

  return (
    <nav className={`navbar navbar-expand-lg theme-${theme}`}>
      <div className="container-fluid">
        <NavbarBrand />

        <DualContextDropdown />

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto align-items-center d-flex">
            {/* Active Imports Indicator - KITT Scanner */}
            {activeImportsCount > 0 && (
              <li className="nav-item">
                <a
                  href="#"
                  className="nav-link"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/import/monitor');
                  }}
                  title={`${activeImportsCount} import${activeImportsCount > 1 ? 's' : ''} running - click to view`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <div className="kitt-scanner">
                    <div className="kitt-scanner-light"></div>
                  </div>
                  <span style={{ color: 'var(--navbar-text)', fontSize: '0.85rem', fontWeight: 500 }}>
                    {activeImportsCount}
                  </span>
                </a>
              </li>
            )}
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