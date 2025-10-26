import React, { useState } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import './SampleNavbar.css';

const SampleNavbar = () => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  return (
    <nav className="sample-navbar">
      <div className="sample-navbar-container">
        {/* Left Section */}
        <div className="sample-navbar-left">
          <button className="sample-navbar-menu-toggle">
            <Menu size={20} />
          </button>
          <div className="sample-navbar-brand">
            <span className="sample-navbar-logo">Sanbox</span>
          </div>
          <div className="sample-navbar-nav">
            <a href="#overview" className="sample-navbar-link active">Overview</a>
            <a href="#zones" className="sample-navbar-link">Zones</a>
            <a href="#storage" className="sample-navbar-link">Storage</a>
            <a href="#reports" className="sample-navbar-link">Reports</a>
          </div>
        </div>

        {/* Right Section */}
        <div className="sample-navbar-right">
          {/* Search */}
          <div className="sample-navbar-search">
            <Search size={16} className="sample-navbar-search-icon" />
            <input
              type="text"
              placeholder="Search..."
              className="sample-navbar-search-input"
            />
            <kbd className="sample-navbar-search-kbd">/</kbd>
          </div>

          {/* Notifications */}
          <button className="sample-navbar-icon-button" title="Notifications">
            <Bell size={18} />
            <span className="sample-navbar-badge">3</span>
          </button>

          {/* User Menu */}
          <div className="sample-navbar-user-menu">
            <button
              className="sample-navbar-user-button"
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <User size={18} />
              <span className="sample-navbar-user-name">Admin</span>
            </button>
            {isUserDropdownOpen && (
              <div className="sample-navbar-dropdown">
                <div className="sample-navbar-dropdown-header">
                  <div className="sample-navbar-dropdown-user">Administrator</div>
                  <div className="sample-navbar-dropdown-email">admin@example.com</div>
                </div>
                <div className="sample-navbar-dropdown-divider"></div>
                <a href="#profile" className="sample-navbar-dropdown-item">Your Profile</a>
                <a href="#settings" className="sample-navbar-dropdown-item">Settings</a>
                <a href="#help" className="sample-navbar-dropdown-item">Help</a>
                <div className="sample-navbar-dropdown-divider"></div>
                <a href="#logout" className="sample-navbar-dropdown-item">Sign Out</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default SampleNavbar;
