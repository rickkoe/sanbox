import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { theme, updateTheme } = useTheme();

  const handleToggle = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    try {
      await updateTheme(newTheme);
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  return (
    <li className="nav-item">
      <button
        className={`nav-link theme-toggle-btn ${theme}`}
        onClick={handleToggle}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        type="button"
      >
        <div className="theme-toggle-track">
          <div className="theme-toggle-thumb">
            {theme === 'light' ? (
              <Sun size={14} className="theme-icon" />
            ) : (
              <Moon size={14} className="theme-icon" />
            )}
          </div>
        </div>
      </button>
    </li>
  );
};

export default ThemeToggle;