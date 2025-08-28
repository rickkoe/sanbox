import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { Info, GitBranch, Calendar, User, Code, Server } from 'lucide-react';

const AboutModal = ({ show, onHide }) => {
  const [versionInfo, setVersionInfo] = useState({
    version: 'Loading...',
    buildDate: 'Loading...',
    commitHash: 'Loading...',
    branch: 'Loading...'
  });

  useEffect(() => {
    // Try to get version from environment variables set at build time
    const version = process.env.REACT_APP_VERSION || process.env.npm_package_version || '1.0.0';
    const buildDate = process.env.REACT_APP_BUILD_DATE || new Date().toISOString().split('T')[0];
    const commitHash = process.env.REACT_APP_COMMIT_HASH || 'unknown';
    const branch = process.env.REACT_APP_BRANCH || 'main';

    setVersionInfo({
      version,
      buildDate,
      commitHash: commitHash.substring(0, 7), // Short hash
      branch
    });
  }, []);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <Server size={24} className="text-primary me-2" />
          About Sanbox
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center mb-4">
          <h5 className="text-dark mb-2">Storage Area Network Management Platform</h5>
        </div>

        {/* Version Information */}
        <div className="row g-3">
          <div className="col-md-6">
            <div className="d-flex align-items-center p-3 bg-light rounded">
              <Code size={20} className="text-primary me-3" />
              <div>
                <div className="fw-semibold">Version</div>
                <div className="text-muted">{versionInfo.version}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="d-flex align-items-center p-3 bg-light rounded">
              <Calendar size={20} className="text-primary me-3" />
              <div>
                <div className="fw-semibold">Build Date</div>
                <div className="text-muted">{versionInfo.buildDate}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="d-flex align-items-center p-3 bg-light rounded">
              <GitBranch size={20} className="text-primary me-3" />
              <div>
                <div className="fw-semibold">Branch</div>
                <div className="text-muted">{versionInfo.branch}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="d-flex align-items-center p-3 bg-light rounded">
              <User size={20} className="text-primary me-3" />
              <div>
                <div className="fw-semibold">Commit</div>
                <div className="text-muted font-monospace">{versionInfo.commitHash}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default AboutModal;