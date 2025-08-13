import React, { useRef } from "react";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";

const FileUploadZone = ({
  dragActive,
  selectedFabric,
  handleDrag,
  handleDrop,
  handleFileSelect
}) => {
  const fileInputRef = useRef(null);
  return (
    <div
      className={`border-2 border-dashed rounded p-4 text-center mb-3 ${
        dragActive ? "border-primary bg-light" : selectedFabric ? "border-secondary" : "border-warning"
      } ${!selectedFabric ? "bg-warning bg-opacity-10" : ""}`}
      onDragEnter={selectedFabric ? handleDrag : undefined}
      onDragLeave={selectedFabric ? handleDrag : undefined}
      onDragOver={selectedFabric ? handleDrag : undefined}
      onDrop={selectedFabric ? handleDrop : undefined}
      style={{ 
        minHeight: "150px", 
        cursor: selectedFabric ? "pointer" : "not-allowed",
        opacity: selectedFabric ? 1 : 0.7
      }}
    >
      <div className="d-flex flex-column align-items-center justify-content-center h-100">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-3 text-muted">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17,8 12,3 7,8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <h5 className="text-muted">
          {selectedFabric ? "Drop alias and zone files here" : "Please select a fabric first"}
        </h5>
        <p className="text-muted mb-2">
          {selectedFabric 
            ? "or click to select files containing alias and zone configurations"
            : "Choose a fabric from the dropdown above to enable file upload"
          }
        </p>
        <input
          type="file"
          multiple
          accept=".txt,text/plain"
          onChange={handleFileSelect}
          style={{ display: "none" }}
          ref={fileInputRef}
        />
        {!selectedFabric ? (
          <OverlayTrigger
            placement="top"
            overlay={<Tooltip>Please select a fabric first</Tooltip>}
          >
            <span className="d-inline-block">
              <Button
                variant="outline-primary"
                disabled={true}
                style={{ pointerEvents: 'none' }}
              >
                Choose Files
              </Button>
            </span>
          </OverlayTrigger>
        ) : (
          <Button
            variant="outline-primary"
            onClick={(e) => {
              console.log("🔄 Choose Files button clicked");
              e.preventDefault();
              e.stopPropagation();
              if (fileInputRef.current) {
                fileInputRef.current.click();
              }
            }}
          >
            Choose Files
          </Button>
        )}
      </div>
    </div>
  );
};

export default FileUploadZone;