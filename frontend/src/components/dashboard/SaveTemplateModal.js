import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes, FaSave, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import './SaveTemplateModal.css';

export const SaveTemplateModal = ({ onSave, onClose, currentLayout }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Template name is required';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Template name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Template name must be less than 50 characters';
    }
    
    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrors({ submit: 'Failed to save template. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const widgetCount = currentLayout?.widgets?.length || 0;

  return createPortal(
    <div className="save-template-modal" onKeyDown={handleKeyDown}>
      <div className="save-template-content">
        <div className="save-template-header">
          <h3><FaSave /> Save Current Layout as Template</h3>
          <button onClick={onClose} className="close-btn">
            <FaTimes />
          </button>
        </div>
        
        <div className="save-template-body">
          <div className="current-layout-info">
            <div className="layout-preview">
              <div className="layout-stats">
                <div className="stat-item">
                  <strong>Current Layout:</strong> {currentLayout?.name || 'My Dashboard'}
                </div>
                <div className="stat-item">
                  <strong>Theme:</strong> {currentLayout?.theme || 'Modern'}
                </div>
                <div className="stat-item">
                  <strong>Widgets:</strong> {widgetCount} configured
                </div>
                <div className="stat-item">
                  <strong>Grid Columns:</strong> {currentLayout?.grid_columns || 12}
                </div>
              </div>
            </div>
            
            {widgetCount === 0 && (
              <div className="warning-message">
                <FaExclamationTriangle />
                <span>Your current dashboard has no widgets. Consider adding some widgets before saving as a template.</span>
              </div>
            )}
          </div>
          
          <form className="save-template-form">
            <div className="form-group">
              <label htmlFor="template-name">
                Template Name <span className="required">*</span>
              </label>
              <input
                id="template-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., My Custom Operations Dashboard"
                className={errors.name ? 'error' : ''}
                maxLength={50}
                autoFocus
              />
              {errors.name && (
                <div className="error-message">{errors.name}</div>
              )}
              <div className="character-count">
                {formData.name.length}/50 characters
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="template-description">
                Description <span className="optional">(optional)</span>
              </label>
              <textarea
                id="template-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what this template is for and who should use it..."
                rows={3}
                className={errors.description ? 'error' : ''}
                maxLength={200}
              />
              {errors.description && (
                <div className="error-message">{errors.description}</div>
              )}
              <div className="character-count">
                {formData.description.length}/200 characters
              </div>
            </div>
            
            <div className="form-group">
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={formData.isPublic}
                    onChange={handleInputChange}
                  />
                  <span className="checkmark"></span>
                  Make this template public
                </label>
                <div className="help-text">
                  {formData.isPublic ? (
                    <span className="public-notice">
                      <FaCheck className="text-success" />
                      This template will be available to all users in your organization
                    </span>
                  ) : (
                    <span className="private-notice">
                      This template will only be visible to you
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {errors.submit && (
              <div className="error-message submit-error">
                <FaExclamationTriangle />
                {errors.submit}
              </div>
            )}
          </form>
        </div>
        
        <div className="save-template-actions">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="btn btn-primary"
            disabled={saving || widgetCount === 0}
          >
            {saving ? (
              <>
                <FaSave className="spinning" /> Saving...
              </>
            ) : (
              <>
                <FaSave /> Save Template
              </>
            )}
          </button>
        </div>
        
        <div className="save-template-footer">
          <small>
            <strong>Tip:</strong> Press Ctrl+Enter to save quickly, or Escape to cancel
          </small>
        </div>
      </div>
    </div>,
    document.body
  );
};