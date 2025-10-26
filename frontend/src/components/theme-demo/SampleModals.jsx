import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import './SampleModals.css';

/**
 * Standardized Modal Component
 * - Theme-aware
 * - Multiple sizes (sm, md, lg, xl)
 * - Optional header, footer
 * - Backdrop click to close
 * - ESC key to close
 */
export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md', // sm, md, lg, xl
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEsc = true
}) => {
  React.useEffect(() => {
    if (!closeOnEsc) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEsc]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className={`modal-container modal-${size}`}>
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            {showCloseButton && (
              <button
                className="modal-close-button"
                onClick={onClose}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Confirmation Modal
 * - Pre-styled for confirm/cancel actions
 * - Variant types (info, warning, danger, success)
 */
export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info', // info, warning, danger, success
  isLoading = false
}) => {
  const icons = {
    info: <Info size={24} />,
    warning: <AlertTriangle size={24} />,
    danger: <AlertCircle size={24} />,
    success: <CheckCircle size={24} />
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="confirm-modal-footer">
          <button
            className="modal-btn modal-btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            className={`modal-btn modal-btn-${variant}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      }
    >
      <div className={`confirm-modal-content confirm-modal-${variant}`}>
        <div className="confirm-modal-icon">
          {icons[variant]}
        </div>
        <div className="confirm-modal-message">
          {message}
        </div>
      </div>
    </Modal>
  );
};

/**
 * Form Modal
 * - Pre-styled for forms
 * - Submit/Cancel buttons
 */
export const FormModal = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  children,
  submitText = 'Save',
  cancelText = 'Cancel',
  isSubmitting = false,
  size = 'md'
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size={size}
      footer={
        <div className="form-modal-footer">
          <button
            type="button"
            className="modal-btn modal-btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {cancelText}
          </button>
          <button
            type="submit"
            form="modal-form"
            className="modal-btn modal-btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : submitText}
          </button>
        </div>
      }
    >
      <form id="modal-form" onSubmit={handleSubmit}>
        {children}
      </form>
    </Modal>
  );
};

/**
 * Demo Component - Shows all modal types
 */
const SampleModals = () => {
  const [basicModal, setBasicModal] = useState(false);
  const [infoModal, setInfoModal] = useState(false);
  const [warningModal, setWarningModal] = useState(false);
  const [dangerModal, setDangerModal] = useState(false);
  const [formModal, setFormModal] = useState(false);
  const [sizeDemo, setSizeDemo] = useState({ open: false, size: 'md' });

  const handleFormSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted');
    setTimeout(() => setFormModal(false), 1000);
  };

  return (
    <div className="sample-modals-demo">
      <h2 className="demo-section-title">Modal Examples</h2>
      <p className="demo-section-desc">
        Standardized, theme-aware modals for consistent UX
      </p>

      <div className="modal-demo-grid">
        {/* Basic Modal */}
        <div className="modal-demo-item">
          <h4>Basic Modal</h4>
          <button
            className="demo-btn"
            onClick={() => setBasicModal(true)}
          >
            Open Basic Modal
          </button>
        </div>

        {/* Confirmation Modals */}
        <div className="modal-demo-item">
          <h4>Info Confirmation</h4>
          <button
            className="demo-btn"
            onClick={() => setInfoModal(true)}
          >
            Open Info Modal
          </button>
        </div>

        <div className="modal-demo-item">
          <h4>Warning Confirmation</h4>
          <button
            className="demo-btn"
            onClick={() => setWarningModal(true)}
          >
            Open Warning Modal
          </button>
        </div>

        <div className="modal-demo-item">
          <h4>Danger Confirmation</h4>
          <button
            className="demo-btn"
            onClick={() => setDangerModal(true)}
          >
            Open Danger Modal
          </button>
        </div>

        {/* Form Modal */}
        <div className="modal-demo-item">
          <h4>Form Modal</h4>
          <button
            className="demo-btn"
            onClick={() => setFormModal(true)}
          >
            Open Form Modal
          </button>
        </div>

        {/* Size Demos */}
        <div className="modal-demo-item">
          <h4>Modal Sizes</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['sm', 'md', 'lg', 'xl'].map(size => (
              <button
                key={size}
                className="demo-btn-sm"
                onClick={() => setSizeDemo({ open: true, size })}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Instances */}
      <Modal
        isOpen={basicModal}
        onClose={() => setBasicModal(false)}
        title="Basic Modal"
        footer={
          <button
            className="modal-btn modal-btn-primary"
            onClick={() => setBasicModal(false)}
          >
            Close
          </button>
        }
      >
        <p>This is a basic modal with a title, body, and footer.</p>
        <p>It's fully theme-aware and will adapt to Light, Dark, and Dark+ themes.</p>
      </Modal>

      <ConfirmModal
        isOpen={infoModal}
        onClose={() => setInfoModal(false)}
        onConfirm={() => {
          console.log('Confirmed');
          setInfoModal(false);
        }}
        title="Information"
        message="This is an informational modal. Use it for general confirmations."
        variant="info"
        confirmText="OK"
      />

      <ConfirmModal
        isOpen={warningModal}
        onClose={() => setWarningModal(false)}
        onConfirm={() => {
          console.log('Warning confirmed');
          setWarningModal(false);
        }}
        title="Warning"
        message="This action requires your attention. Are you sure you want to proceed?"
        variant="warning"
        confirmText="Proceed"
      />

      <ConfirmModal
        isOpen={dangerModal}
        onClose={() => setDangerModal(false)}
        onConfirm={() => {
          console.log('Dangerous action confirmed');
          setDangerModal(false);
        }}
        title="Delete Item"
        message="This action cannot be undone. Are you sure you want to delete this item?"
        variant="danger"
        confirmText="Delete"
      />

      <FormModal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        onSubmit={handleFormSubmit}
        title="Edit Item"
        submitText="Save Changes"
      >
        <div className="form-group">
          <label>Item Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Enter item name"
            defaultValue="Sample Item"
          />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            className="form-textarea"
            rows="3"
            placeholder="Enter description"
            defaultValue="Sample description"
          />
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input type="checkbox" defaultChecked />
            <span>Active</span>
          </label>
        </div>
      </FormModal>

      <Modal
        isOpen={sizeDemo.open}
        onClose={() => setSizeDemo({ ...sizeDemo, open: false })}
        title={`${sizeDemo.size.toUpperCase()} Modal`}
        size={sizeDemo.size}
        footer={
          <button
            className="modal-btn modal-btn-primary"
            onClick={() => setSizeDemo({ ...sizeDemo, open: false })}
          >
            Close
          </button>
        }
      >
        <p>This is a <strong>{sizeDemo.size}</strong> sized modal.</p>
        <p>Available sizes: sm (400px), md (600px), lg (800px), xl (1000px)</p>
      </Modal>
    </div>
  );
};

export default SampleModals;
