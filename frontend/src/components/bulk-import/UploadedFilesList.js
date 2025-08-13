import React from "react";
import { Card, Badge } from "react-bootstrap";

const UploadedFilesList = ({ uploadedFiles, parsedData }) => {
  if (!uploadedFiles.length) return null;

  return (
    <Card className="mb-3" data-section="uploaded-files">
      <Card.Header>
        <h6 className="mb-0 text-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <path d="M9 15l2 2 4-4"/>
          </svg>
          Uploaded Files ({uploadedFiles.length})
        </h6>
      </Card.Header>
      <Card.Body>
        {uploadedFiles.map((file, index) => (
          <div key={index} className="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
            <div>
              <strong>{file.fileName}</strong>
              <small className="text-muted ms-2">
                ({(file.fileSize / 1024).toFixed(1)} KB)
              </small>
            </div>
            <div className="d-flex gap-2">
              <Badge bg={
                file.dataType === "alias" ? "primary" : 
                file.dataType === "tech-support" ? "warning" :
                "secondary"
              }>
                {file.dataType}
              </Badge>
              <Badge bg="info">{file.itemCount} items</Badge>
            </div>
          </div>
        ))}
        <div className="mt-2 p-2 bg-primary bg-opacity-10 rounded">
          <strong>Total: {parsedData.length} items ready for import</strong>
        </div>
      </Card.Body>
    </Card>
  );
};

export default UploadedFilesList;