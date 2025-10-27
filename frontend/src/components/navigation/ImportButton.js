import React from "react";
import PropTypes from "prop-types";
import { NavLink, useLocation } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Download } from "lucide-react";

const ImportButton = ({ 
  isImportRunning, 
  importProgress, 
  currentImport, 
  onCancelImport 
}) => {
  const location = useLocation();
  const isImportActive = location.pathname.startsWith('/import');
  
  if (isImportRunning) {
    return (
      <li className="nav-item">
        <Dropdown align="end">
          <Dropdown.Toggle 
            as="span" 
            className={`nav-link ${isImportActive ? 'active' : ''}`}
            style={{ cursor: "pointer" }}
            title={importProgress?.status || 'Import Running'}
          >
            <div className="import-progress-container">
              <Download size={24} />
              <div className="import-progress-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <span className="nav-label ms-1">Import</span>
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as={NavLink} to="/import/universal">
              View Import Details
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item
              onClick={async () => {
                if (currentImport?.id && window.confirm('Cancel the current import?')) {
                  await onCancelImport(currentImport.id);
                }
              }}
              className="text-danger"
            >
              Cancel Import
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </li>
    );
  }

  return (
    <li className="nav-item">
      <Dropdown align="end">
        <Dropdown.Toggle 
          as="span" 
          className={`nav-link ${isImportActive ? 'active' : ''}`}
          style={{ cursor: "pointer" }}
          title="Data Import"
        >
          <Download size={24} />
          <span className="nav-label ms-1">Import</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item as={NavLink} to="/import/universal">
            Universal Importer
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </li>
  );
};

ImportButton.propTypes = {
  isImportRunning: PropTypes.bool.isRequired,
  importProgress: PropTypes.object,
  currentImport: PropTypes.object,
  onCancelImport: PropTypes.func.isRequired,
};

export default ImportButton;