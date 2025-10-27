import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import { Info, GitBranch, Calendar, User, Code, Server } from 'lucide-react';
import './AboutPage.css';

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
    <Modal show={show} onHide={onHide} size="lg" centered className="about-modal">
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <Server size={24} className="about-info-icon me-2" />
          About Sanbox
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center mb-4">
          <h5 className="about-title mb-2">Storage Area Network Management Platform</h5>
        </div>

        {/* Version Information */}
        <div className="row g-3">
          <div className="col-md-6">
            <div className="about-info-card">
              <Code size={20} className="about-info-icon" />
              <div>
                <div className="about-info-label">Version</div>
                <div className="about-info-value">{versionInfo.version}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="about-info-card">
              <Calendar size={20} className="about-info-icon" />
              <div>
                <div className="about-info-label">Build Date</div>
                <div className="about-info-value">{versionInfo.buildDate}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="about-info-card">
              <GitBranch size={20} className="about-info-icon" />
              <div>
                <div className="about-info-label">Branch</div>
                <div className="about-info-value">{versionInfo.branch}</div>
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="about-info-card">
              <User size={20} className="about-info-icon" />
              <div>
                <div className="about-info-label">Commit</div>
                <div className="about-info-value-mono">{versionInfo.commitHash}</div>
              </div>
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default AboutModal;