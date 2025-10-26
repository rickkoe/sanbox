import React from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import SampleNavbar from '../components/theme-demo/SampleNavbar';
import SampleSidebar from '../components/theme-demo/SampleSidebar';
import SampleTable from '../components/theme-demo/SampleTable';
import SamplePage from '../components/theme-demo/SamplePage';
import SampleModals from '../components/theme-demo/SampleModals';
import SampleDropdowns from '../components/theme-demo/SampleDropdowns';
import '../styles/theme-demo.css';
import '../styles/themes-demo.css'; // Demo-only theme file - does NOT affect main app

const ThemeDemoContent = () => {
  const { theme, updateTheme } = useTheme();

  const themes = [
    { id: 'light', name: 'Light', description: 'Clean, professional light theme' },
    { id: 'dark', name: 'Dark', description: 'Balanced dark theme for extended use' },
    { id: 'dark-plus', name: 'Dark+', description: 'High contrast dark theme' }
  ];

  return (
    <div className={`theme-demo-root theme-${theme}`}>
      {/* Theme Switcher Panel */}
      <div className="theme-demo-switcher">
        <div className="theme-demo-switcher-header">
          <h2>Theme Demo</h2>
          <p>Select a theme to preview</p>
        </div>
        <div className="theme-demo-switcher-options">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`theme-demo-option ${theme === t.id ? 'active' : ''}`}
              onClick={() => updateTheme(t.id)}
            >
              <div className="theme-demo-option-name">{t.name}</div>
              <div className="theme-demo-option-desc">{t.description}</div>
              {theme === t.id && <div className="theme-demo-option-check">✓</div>}
            </button>
          ))}
        </div>
        <div className="theme-demo-switcher-info">
          <p>
            <strong>Current Theme:</strong> {themes.find(t => t.id === theme)?.name}
          </p>
          <p className="theme-demo-switcher-note">
            This is a sandbox for perfecting the theme design. Changes here won't affect the main application until deployed.
          </p>
        </div>
      </div>

      {/* Demo Layout */}
      <div className="theme-demo-layout">
        <SampleNavbar />
        <div className="theme-demo-main">
          <SampleSidebar />
          <div className="theme-demo-content">
            <SamplePage />

            <div className="theme-demo-section">
              <SampleModals />
            </div>

            <div className="theme-demo-section">
              <SampleDropdowns />
            </div>

            <div className="theme-demo-table-section">
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <h2 style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 700,
                  color: 'var(--primary-text)',
                  margin: 0,
                  marginBottom: 'var(--space-2)'
                }}>
                  TanStack Table Example
                </h2>
                <p style={{
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--secondary-text)',
                  margin: 0
                }}>
                  Full-featured data table with sorting, pagination, and row interactions
                </p>
              </div>
              <SampleTable />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ThemeDemo = () => {
  return (
    <ThemeProvider>
      <ThemeDemoContent />
    </ThemeProvider>
  );
};

export default ThemeDemo;
