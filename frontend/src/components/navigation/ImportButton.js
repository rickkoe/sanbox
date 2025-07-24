import React from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { Dropdown } from "react-bootstrap";
import { Download } from "lucide-react";

const ImportButton = ({ 
  isImportRunning, 
  importProgress, 
  currentImport, 
  onCancelImport 
}) => {
  if (isImportRunning) {
    return (
      <li className="nav-item">
        <Dropdown align="end">
          <Dropdown.Toggle 
            as="span" 
            className="nav-link" 
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
            <Dropdown.Item as={NavLink} to="/insights/importer">
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
          className="nav-link" 
          style={{ cursor: "pointer" }}
          title="Data Import"
        >
          <Download size={24} />
          <span className="nav-label ms-1">Import</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Item as={NavLink} to="/insights/importer">
            Storage Insights Import
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item as={NavLink} to="/san/aliases/import">
            Import Aliases
          </Dropdown.Item>
          <Dropdown.Item as={NavLink} to="/san/zones/import">
            Import Zones
          </Dropdown.Item>
          <Dropdown.Item as={NavLink} to="/san/bulk-import">
            <strong>Bulk Zoning Import</strong>
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