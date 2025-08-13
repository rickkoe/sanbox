import React from "react";
import { Alert, Button, Spinner } from "react-bootstrap";

const ImportActions = ({
  showPreviewSection,
  parsedData,
  getImportStats,
  importing,
  selectedAliases,
  selectedZones,
  handleImportSelected,
  handleImportAll,
  handleImportSelectedZones
}) => {
  if (!showPreviewSection || !parsedData.length) return null;

  const stats = getImportStats();

  return (
    <>
      {/* Duplicate Warning */}
      {stats.duplicates > 0 && (
        <Alert variant="warning" className="mb-3">
          <strong>⚠️ Duplicate Detection:</strong> {stats.duplicateAliases} aliases and {stats.duplicateZones} zones already exist in the database and will be skipped. 
          Only {stats.newAliases} new aliases and {stats.newZones} zones will be imported.
        </Alert>
      )}
      
      <div className="d-flex gap-2 mb-3">
        <Button 
          variant="primary" 
          onClick={handleImportSelected} 
          disabled={importing || (selectedAliases.size === 0 && selectedZones.size === 0)}
          title={`Import ${selectedAliases.size} selected aliases and ${selectedZones.size} selected zones`}
        >
          {importing ? (
            <>
              <Spinner size="sm" className="me-1" />
              Importing...
            </>
          ) : (
            `Import Selected (${selectedAliases.size + selectedZones.size})`
          )}
        </Button>

        <Button 
          variant="success" 
          onClick={handleImportAll} 
          disabled={importing || stats.new === 0}
          title={`Import all ${stats.newAliases} new aliases and ${stats.newZones} new zones`}
        >
          {importing ? (
            <>
              <Spinner size="sm" className="me-1" />
              Importing...
            </>
          ) : (
            `Import All New (${stats.new})`
          )}
        </Button>

        {parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined).length > 0 && selectedZones.size > 0 && (
          <Button 
            variant="outline-secondary" 
            onClick={handleImportSelectedZones}
            disabled={importing || selectedZones.size === 0}
            title={`Import only ${selectedZones.size} selected zones`}
          >
            {importing ? (
              <>
                <Spinner size="sm" className="me-1" />
                Importing...
              </>
            ) : (
              `Zones Only (${selectedZones.size})`
            )}
          </Button>
        )}
      </div>

      {/* Import Statistics Summary */}
      {stats.total > 0 && (
        <Alert variant="info" className="mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Import Summary:</strong> 
              <span className="ms-2">
                {stats.newAliases > 0 && <span className="me-2">📋 {stats.newAliases} new aliases</span>}
                {stats.newZones > 0 && <span className="me-2">🔗 {stats.newZones} new zones</span>}
                {stats.duplicates > 0 && <span className="text-muted">({stats.duplicates} duplicates will be skipped)</span>}
              </span>
            </div>
            <div>
              <strong>Selected:</strong> {selectedAliases.size + selectedZones.size} items
            </div>
          </div>
        </Alert>
      )}
    </>
  );
};

export default ImportActions;