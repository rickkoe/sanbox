import React, { useState, useRef, useEffect } from 'react';
import { FaPalette, FaCheck } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';
import './ThemeDropdown.css';

const ThemeDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, updateTheme } = useTheme();
  const dropdownRef = useRef(null);

  const themes = [
    { name: 'light', display: 'Light', description: 'Clean and bright interface' },
    { name: 'dark', display: 'Dark', description: 'Dark mode with teal accents' }
  ];

  const handleThemeSelect = async (themeName, event) => {
    // Prevent event propagation to avoid dropdown closing prematurely
    event?.stopPropagation();
    
    try {
      await updateTheme(themeName);
      
      // Small delay to ensure theme is applied before closing dropdown
      setTimeout(() => {
        setIsOpen(false);
      }, 150);
    } catch (error) {
      console.error('Failed to update theme:', error);
      // Keep dropdown open if there's an error
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const currentTheme = themes.find(t => t.name === theme) || themes[0];

  return (
    <li className="nav-item dropdown theme-dropdown" ref={dropdownRef}>
      <button
        className="nav-link dropdown-toggle theme-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <FaPalette className="theme-icon" />
        <span className="theme-label">{currentTheme.display}</span>
      </button>

      {isOpen && (
        <div className="dropdown-menu theme-menu show">
          <div className="theme-menu-header">
            <h6>Choose Theme</h6>
            <p>Select a theme for the entire application</p>
          </div>
          
          {themes.map((themeOption) => (
            <button
              key={themeOption.name}
              className={`dropdown-item theme-option ${theme === themeOption.name ? 'active' : ''}`}
              onClick={(e) => handleThemeSelect(themeOption.name, e)}
            >
              <div className="theme-preview">
                <div className={`theme-preview-bg theme-preview-${themeOption.name}`}></div>
              </div>
              <div className="theme-info">
                <div className="theme-name">
                  {themeOption.display}
                  {theme === themeOption.name && <FaCheck className="theme-check" />}
                </div>
                <div className="theme-description">{themeOption.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </li>
  );
};

export default ThemeDropdown;