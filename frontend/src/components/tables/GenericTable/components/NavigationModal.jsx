import React from 'react';
import { Modal } from "react-bootstrap";

const NavigationModal = ({ show, onHide, onLeave }) => {
  return (
    <Modal show={show} onHide={onHide} backdrop="static" className="modern-modal">
      <Modal.Header closeButton className="modern-modal-header">
        <Modal.Title>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Unsaved Changes
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="modern-modal-body">
        <p>You have unsaved changes that will be lost if you navigate away. Are you sure you want to continue?</p>
      </Modal.Body>
      <Modal.Footer className="modern-modal-footer">
        <button className="modern-btn modern-btn-secondary" onClick={onHide}>
          Stay & Save
        </button>
        <button className="modern-btn modern-btn-danger" onClick={onLeave}>
          Leave Without Saving
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default NavigationModal;