import React, { useState, useEffect } from 'react';
import { FaTimes, FaPalette, FaCheck } from 'react-icons/fa';
import axios from 'axios';
import './ThemeSelector.css';

export const ThemeSelector = ({ currentTheme, onThemeSelect, onClose }) => {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        // For now, use predefined themes
        setThemes([
          {
            name: 'modern',
            display_name: 'Modern',
            description: 'Clean and contemporary design with subtle gradients',
            preview: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
          },
          {
            name: 'dark',
            display_name: 'Dark Mode',
            description: 'Dark theme for low-light environments',
            preview: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)'
          },
          {
            name: 'minimal',
            display_name: 'Minimal',
            description: 'Clean and simple with minimal distractions',
            preview: '#fafafa'
          },
          {
            name: 'corporate',
            display_name: 'Corporate',
            description: 'Professional blue theme for business environments',
            preview: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'
          },
          {
            name: 'colorful',
            display_name: 'Colorful',
            description: 'Vibrant and energetic with dynamic colors',
            preview: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4)'
          }
        ]);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching themes:', err);
        setLoading(false);
      }
    };

    fetchThemes();
  }, []);

  if (loading) {
    return (
      <div className="theme-selector-modal">
        <div className="theme-selector-content">
          <div className="loading">Loading themes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-selector-modal">
      <div className="theme-selector-content">
        <div className="theme-header">
          <h3><FaPalette /> Choose Theme</h3>
          <button onClick={onClose} className="close-btn">
            <FaTimes />
          </button>
        </div>
        
        <div className="themes-grid">
          {themes.map(theme => (
            <div
              key={theme.name}
              className={`theme-card ${currentTheme === theme.name ? 'selected' : ''}`}
              onClick={() => onThemeSelect(theme)}
            >
              <div 
                className="theme-preview"
                style={{ background: theme.preview }}
              >
                {currentTheme === theme.name && (
                  <div className="selected-indicator">
                    <FaCheck />
                  </div>
                )}
              </div>
              <div className="theme-info">
                <h4>{theme.display_name}</h4>
                <p>{theme.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};