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
        // Simplified to only light and dark themes
        setThemes([
          {
            name: 'light',
            display_name: 'Light',
            description: 'Clean and bright interface with excellent readability',
            preview: '#ffffff'
          },
          {
            name: 'dark',
            display_name: 'Dark',
            description: 'Dark theme with teal accents for low-light environments',
            preview: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)'
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