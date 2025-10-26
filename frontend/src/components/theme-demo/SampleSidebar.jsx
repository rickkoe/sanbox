import React, { useState } from 'react';
import {
  LayoutDashboard,
  Database,
  HardDrive,
  Network,
  Users,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Package
} from 'lucide-react';
import './SampleSidebar.css';

const SampleSidebar = () => {
  const [expandedSections, setExpandedSections] = useState(['san', 'storage']);

  const toggleSection = (section) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <aside className="sample-sidebar">
      <div className="sample-sidebar-content">
        {/* Navigation Sections */}
        <nav className="sample-sidebar-nav">
          {/* Dashboard */}
          <a href="#dashboard" className="sample-sidebar-item active">
            <LayoutDashboard size={18} className="sample-sidebar-icon" />
            <span>Dashboard</span>
          </a>

          {/* SAN Management Section */}
          <div className="sample-sidebar-section">
            <button
              className="sample-sidebar-section-header"
              onClick={() => toggleSection('san')}
            >
              <div className="sample-sidebar-section-title">
                <Network size={18} className="sample-sidebar-icon" />
                <span>SAN</span>
              </div>
              {expandedSections.includes('san') ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            {expandedSections.includes('san') && (
              <div className="sample-sidebar-section-items">
                <a href="#zones" className="sample-sidebar-subitem">Zones</a>
                <a href="#aliases" className="sample-sidebar-subitem">Aliases</a>
                <a href="#fabrics" className="sample-sidebar-subitem">Fabrics</a>
                <a href="#switches" className="sample-sidebar-subitem">Switches</a>
              </div>
            )}
          </div>

          {/* Storage Section */}
          <div className="sample-sidebar-section">
            <button
              className="sample-sidebar-section-header"
              onClick={() => toggleSection('storage')}
            >
              <div className="sample-sidebar-section-title">
                <HardDrive size={18} className="sample-sidebar-icon" />
                <span>Storage</span>
              </div>
              {expandedSections.includes('storage') ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            {expandedSections.includes('storage') && (
              <div className="sample-sidebar-section-items">
                <a href="#systems" className="sample-sidebar-subitem">Systems</a>
                <a href="#volumes" className="sample-sidebar-subitem">Volumes</a>
                <a href="#pools" className="sample-sidebar-subitem">Pools</a>
              </div>
            )}
          </div>

          {/* Customers */}
          <a href="#customers" className="sample-sidebar-item">
            <Users size={18} className="sample-sidebar-icon" />
            <span>Customers</span>
          </a>

          {/* Data Management Section */}
          <div className="sample-sidebar-section">
            <button
              className="sample-sidebar-section-header"
              onClick={() => toggleSection('data')}
            >
              <div className="sample-sidebar-section-title">
                <Database size={18} className="sample-sidebar-icon" />
                <span>Data</span>
              </div>
              {expandedSections.includes('data') ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
            {expandedSections.includes('data') && (
              <div className="sample-sidebar-section-items">
                <a href="#import" className="sample-sidebar-subitem">Import</a>
                <a href="#export" className="sample-sidebar-subitem">Export</a>
                <a href="#backup" className="sample-sidebar-subitem">Backup</a>
              </div>
            )}
          </div>

          {/* Reports */}
          <a href="#reports" className="sample-sidebar-item">
            <BarChart3 size={18} className="sample-sidebar-icon" />
            <span>Reports</span>
          </a>

          {/* Tools */}
          <a href="#tools" className="sample-sidebar-item">
            <Package size={18} className="sample-sidebar-icon" />
            <span>Tools</span>
          </a>
        </nav>

        {/* Footer Section */}
        <div className="sample-sidebar-footer">
          <div className="sample-sidebar-divider"></div>
          <a href="#documentation" className="sample-sidebar-item">
            <FileText size={18} className="sample-sidebar-icon" />
            <span>Documentation</span>
          </a>
          <a href="#settings" className="sample-sidebar-item">
            <Settings size={18} className="sample-sidebar-icon" />
            <span>Settings</span>
          </a>
        </div>
      </div>
    </aside>
  );
};

export default SampleSidebar;
