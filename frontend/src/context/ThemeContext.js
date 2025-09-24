import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Try to get theme from localStorage first
    const savedTheme = localStorage.getItem('dashboard-theme');
    // Map old theme names to new simplified themes
    if (savedTheme === 'minimal') return 'light';
    if (['modern', 'corporate', 'colorful'].includes(savedTheme)) return 'light';
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  // Store dashboard update function
  const dashboardUpdateRef = useRef(null);

  const updateTheme = async (newTheme) => {
    // Update theme immediately for UI responsiveness
    setTheme(newTheme);
    localStorage.setItem('dashboard-theme', newTheme);

    // If dashboard update function is registered, call it
    if (dashboardUpdateRef.current) {
      try {
        await dashboardUpdateRef.current(newTheme);
      } catch (error) {
        // Silently fail dashboard updates - theme still works in UI
        // Dashboard database might be locked or unavailable
      }
    }
    
    // Always resolve successfully for UI updates
    return Promise.resolve();
  };

  const registerDashboardUpdate = (updateFunction) => {
    dashboardUpdateRef.current = updateFunction;
  };

  const unregisterDashboardUpdate = () => {
    dashboardUpdateRef.current = null;
  };

  // Listen for theme changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard-theme' && e.newValue) {
        setTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      updateTheme, 
      registerDashboardUpdate, 
      unregisterDashboardUpdate 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;