import React from 'react';
import { Modal } from "react-bootstrap";

const DeleteModal = ({ show, onHide, rowsToDelete, onConfirm, onCancel }) => {
  return (
    <Modal show={show} onHide={onHide} backdrop="static" className="modern-modal">
      <Modal.Header closeButton className="modern-modal-header">
        <Modal.Title>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          Confirm Delete
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="modern-modal-body">
        <p>Are you sure you want to delete the following items? This action cannot be undone.</p>
        <div className="delete-items-list">
          {rowsToDelete.map(r => (
            <div key={r.id} className="delete-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {r.name || `ID: ${r.id}`}
            </div>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer className="modern-modal-footer">
        <button className="modern-btn modern-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="modern-btn modern-btn-danger" onClick={onConfirm}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/>
          </svg>
          Delete Items
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default DeleteModal;