import React, { useState, useEffect } from 'react';
import { Search, ChevronRight, ChevronDown, BookOpen, Menu, X } from 'lucide-react';
import '../styles/user-manual.css';

const UserManual = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('introduction');
  const [expandedSections, setExpandedSections] = useState({
    'getting-started': true,
    'organization': false,
    'san-management': false,
    'storage-management': false,
    'scripts': false,
    'data-import': false,
    'tools': false,
    'backup': false,
    'settings': false
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Scroll to section when activeSection changes
  useEffect(() => {
    const element = document.getElementById(activeSection);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const tableOfContents = [
    {
      id: 'introduction',
      title: 'Introduction',
      level: 0
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      level: 0,
      children: [
        { id: 'login', title: 'Logging In', level: 1 },
        { id: 'navigation', title: 'Navigation Overview', level: 1 },
        { id: 'dashboard', title: 'Dashboard', level: 1 },
        { id: 'context', title: 'Customer & Project Context', level: 1 }
      ]
    },
    {
      id: 'organization',
      title: 'Organization Management',
      level: 0,
      children: [
        { id: 'customers', title: 'Managing Customers', level: 1 },
        { id: 'projects', title: 'Managing Projects', level: 1 }
      ]
    },
    {
      id: 'san-management',
      title: 'SAN Management',
      level: 0,
      children: [
        { id: 'san-overview', title: 'SAN Overview', level: 1 },
        { id: 'switches', title: 'Managing Switches', level: 1 },
        { id: 'fabrics', title: 'Managing Fabrics', level: 1 },
        { id: 'aliases', title: 'Managing Aliases', level: 1 },
        { id: 'zones', title: 'Managing Zones', level: 1 }
      ]
    },
    {
      id: 'storage-management',
      title: 'Storage Management',
      level: 0,
      children: [
        { id: 'storage-overview', title: 'Storage Overview', level: 1 },
        { id: 'storage-systems', title: 'Storage Systems', level: 1 },
        { id: 'volumes', title: 'Managing Volumes', level: 1 },
        { id: 'hosts', title: 'Managing Hosts', level: 1 },
        { id: 'ports', title: 'Managing Ports', level: 1 }
      ]
    },
    {
      id: 'scripts',
      title: 'Script Generation',
      level: 0,
      children: [
        { id: 'scripts-overview', title: 'Scripts Overview', level: 1 },
        { id: 'san-scripts', title: 'SAN Zoning Scripts', level: 1 },
        { id: 'ds8000-scripts', title: 'DS8000 Scripts', level: 1 },
        { id: 'flashsystem-scripts', title: 'FlashSystem Scripts', level: 1 }
      ]
    },
    {
      id: 'data-import',
      title: 'Data Import',
      level: 0,
      children: [
        { id: 'import-overview', title: 'Import Overview', level: 1 },
        { id: 'san-import', title: 'SAN Configuration Import', level: 1 },
        { id: 'storage-import', title: 'Storage Insights Import', level: 1 },
        { id: 'import-monitor', title: 'Import Monitor', level: 1 }
      ]
    },
    {
      id: 'tools',
      title: 'Tools & Calculators',
      level: 0,
      children: [
        { id: 'tools-overview', title: 'Tools Overview', level: 1 },
        { id: 'wwpn-colonizer', title: 'WWPN Colonizer', level: 1 },
        { id: 'custom-naming', title: 'Custom Naming', level: 1 },
        { id: 'calculators', title: 'Storage Calculators', level: 1 },
        { id: 'doc-builder', title: 'Doc Builder', level: 1 }
      ]
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      level: 0,
      children: [
        { id: 'backup-overview', title: 'Backup Overview', level: 1 },
        { id: 'create-backup', title: 'Creating Backups', level: 1 },
        { id: 'restore-backup', title: 'Restoring Backups', level: 1 },
        { id: 'backup-schedule', title: 'Backup Scheduling', level: 1 },
        { id: 'backup-dashboard', title: 'Backup Dashboard', level: 1 }
      ]
    },
    {
      id: 'settings',
      title: 'Settings & Preferences',
      level: 0,
      children: [
        { id: 'app-settings', title: 'Application Settings', level: 1 },
        { id: 'user-profile', title: 'User Profile', level: 1 },
        { id: 'table-preferences', title: 'Table Preferences', level: 1 }
      ]
    },
    {
      id: 'tables',
      title: 'Working with Tables',
      level: 0,
      children: [
        { id: 'table-features', title: 'Table Features', level: 1 },
        { id: 'table-filtering', title: 'Filtering & Searching', level: 1 },
        { id: 'table-export', title: 'Exporting Data', level: 1 },
        { id: 'table-editing', title: 'Editing Records', level: 1 }
      ]
    },
    {
      id: 'faq',
      title: 'FAQ & Troubleshooting',
      level: 0
    }
  ];

  const renderTOCItem = (item) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedSections[item.id];
    const isActive = activeSection === item.id;

    return (
      <div key={item.id} className="toc-item-container">
        <div
          className={`toc-item level-${item.level} ${isActive ? 'active' : ''}`}
          onClick={() => {
            if (hasChildren) {
              toggleSection(item.id);
            }
            setActiveSection(item.id);
          }}
        >
          {hasChildren && (
            <span className="toc-icon">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span className="toc-title">{item.title}</span>
        </div>
        {hasChildren && isExpanded && (
          <div className="toc-children">
            {item.children.map(child => (
              <div
                key={child.id}
                className={`toc-item level-${child.level} ${activeSection === child.id ? 'active' : ''}`}
                onClick={() => setActiveSection(child.id)}
              >
                <span className="toc-title">{child.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="user-manual-container">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Main Content - Left Side */}
      <main className="manual-content">
        <article>
          {/* Introduction */}
          <section id="introduction" className="manual-section">
            <h1>Sanbox User Manual</h1>
            <p className="lead">
              Welcome to Sanbox, your comprehensive solution for managing SAN (Storage Area Network) infrastructure
              and enterprise storage systems. This manual will guide you through all features and capabilities of the application.
            </p>
            <div className="info-box">
              <strong>What is Sanbox?</strong>
              <p>
                Sanbox is a full-stack web application designed to help IT professionals manage complex storage
                environments including SAN fabrics, zones, aliases, storage systems, volumes, and hosts. It provides
                tools for configuration management, data import/export, script generation, and capacity planning.
              </p>
            </div>
          </section>

          {/* Getting Started */}
          <section id="getting-started" className="manual-section">
            <h2>Getting Started</h2>
            <p>This section covers the basics of logging in and navigating the Sanbox application.</p>
          </section>

          <section id="login" className="manual-section">
            <h3>Logging In</h3>
            <p>To access Sanbox:</p>
            <ol>
              <li>Navigate to the Sanbox URL provided by your administrator</li>
              <li>Enter your <strong>username</strong> and <strong>password</strong></li>
              <li>Click the <strong>Login</strong> button</li>
            </ol>
            <div className="tip-box">
              <strong>Tip:</strong> If you forgot your password, contact your system administrator to reset it.
            </div>
          </section>

          <section id="navigation" className="manual-section">
            <h3>Navigation Overview</h3>
            <p>Sanbox uses a modern navigation system with three main components:</p>

            <h4>Top Navigation Bar</h4>
            <ul>
              <li><strong>Brand/Logo:</strong> Displays the application name</li>
              <li><strong>Context Indicator:</strong> Shows your active Customer and Project (click to change)</li>
              <li><strong>Active Imports:</strong> Animated indicator showing running import jobs</li>
              <li><strong>Theme Toggle:</strong> Switch between Light and Dark themes</li>
              <li><strong>Settings Menu:</strong> Access Project Config, App Settings, and Backup & Restore</li>
              <li><strong>Help Menu:</strong> View About information and access Admin Panel</li>
              <li><strong>User Menu:</strong> View profile, change settings, and logout</li>
            </ul>

            <h4>Left Sidebar</h4>
            <p>The collapsible sidebar organizes features into seven main sections:</p>
            <ul>
              <li><strong>Dashboard:</strong> Customizable home page with widgets</li>
              <li><strong>Organization:</strong> Customers and Projects</li>
              <li><strong>SAN:</strong> Switches, Fabrics, Aliases, and Zones</li>
              <li><strong>Storage:</strong> Systems, Volumes, Hosts, and Ports</li>
              <li><strong>Scripts:</strong> SAN and Storage script generators</li>
              <li><strong>Data Import:</strong> Universal Importer and Import History</li>
              <li><strong>Tools:</strong> Calculators and utility tools</li>
            </ul>

            <h4>Breadcrumb Trail</h4>
            <p>Below the top navigation bar, breadcrumbs show your current location and navigation path.</p>
          </section>

          <section id="dashboard" className="manual-section">
            <h3>Dashboard</h3>
            <p>
              The Dashboard is your home page, providing an at-a-glance view of your SAN and storage environment.
            </p>

            <h4>Customizing Your Dashboard</h4>
            <ol>
              <li>Click the <strong>Edit Mode</strong> toggle to enter customization mode</li>
              <li>Drag widgets to rearrange their position</li>
              <li>Click <strong>Widget Marketplace</strong> to add or remove widgets</li>
              <li>Use <strong>Dashboard Presets</strong> to save, load, or reset your layout</li>
            </ol>

            <h4>Available Widgets</h4>
            <ul>
              <li><strong>SAN Overview:</strong> Summary of fabrics, zones, and aliases</li>
              <li><strong>Storage Inventory:</strong> Storage systems and capacity metrics</li>
              <li><strong>Host Connectivity:</strong> Connected hosts and WWPNs</li>
              <li><strong>Import Activity:</strong> Recent import jobs and status</li>
              <li><strong>Backup Health:</strong> Backup status and health score</li>
              <li><strong>Storage Capacity:</strong> Capacity utilization charts</li>
              <li><strong>Zone Deployment:</strong> Zone configuration statistics</li>
              <li><strong>Alias Distribution:</strong> Alias usage by fabric</li>
            </ul>

            <div className="tip-box">
              <strong>Tip:</strong> Enable auto-refresh to keep your dashboard data up-to-date automatically.
            </div>
          </section>

          <section id="context" className="manual-section">
            <h3>Customer & Project Context</h3>
            <p>
              Sanbox uses a context system to scope all your work to a specific <strong>Customer</strong> and
              <strong>Project</strong>. This ensures data isolation and organization.
            </p>

            <h4>Setting Your Active Context</h4>
            <ol>
              <li>Click the <strong>Context Indicator</strong> in the top navigation bar</li>
              <li>Or navigate to <strong>Settings → Project Configuration</strong></li>
              <li>Select your <strong>Active Customer</strong> from the dropdown</li>
              <li>Select your <strong>Active Project</strong> (within that customer)</li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <div className="warning-box">
              <strong>Important:</strong> All data you view and create will be associated with your active Customer and Project.
              Always verify you have the correct context selected before making changes.
            </div>
          </section>

          {/* Organization Management */}
          <section id="organization" className="manual-section">
            <h2>Organization Management</h2>
            <p>Manage your customers and projects to organize your storage infrastructure work.</p>
          </section>

          <section id="customers" className="manual-section">
            <h3>Managing Customers</h3>
            <p>
              Customers represent the organizations you manage. Navigate to <strong>Organization → Customers</strong>
              to view and manage customer records.
            </p>

            <h4>Creating a New Customer</h4>
            <ol>
              <li>Click the <strong>Add New</strong> button above the table</li>
              <li>Enter the customer <strong>Name</strong> (required)</li>
              <li>Add optional <strong>Notes</strong></li>
              <li>Enter IBM Storage Insights credentials if applicable:
                <ul>
                  <li><strong>API Key:</strong> IBM Storage Insights API key</li>
                  <li><strong>Tenant ID:</strong> IBM Storage Insights tenant identifier</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <h4>Editing a Customer</h4>
            <ul>
              <li><strong>Inline Editing:</strong> Click any cell in the table to edit directly</li>
              <li><strong>Form Editing:</strong> Click the edit icon to open a form</li>
            </ul>

            <h4>Deleting a Customer</h4>
            <ol>
              <li>Select the customer row(s) you want to delete</li>
              <li>Click the <strong>Delete</strong> button</li>
              <li>Confirm the deletion in the dialog</li>
            </ol>
            <div className="warning-box">
              <strong>Warning:</strong> Deleting a customer will also delete all associated projects, SAN configurations,
              and storage data. This action cannot be undone.
            </div>
          </section>

          <section id="projects" className="manual-section">
            <h3>Managing Projects</h3>
            <p>
              Projects help you organize work within a customer. Navigate to <strong>Organization → Projects</strong>.
            </p>

            <h4>Creating a New Project</h4>
            <ol>
              <li>Ensure you have an <strong>Active Customer</strong> selected</li>
              <li>Click <strong>Add New</strong></li>
              <li>Enter the project <strong>Name</strong></li>
              <li>Add optional <strong>Notes</strong></li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> Use projects to separate different initiatives, environments (Dev/Test/Prod),
              or physical locations.
            </div>
          </section>

          {/* SAN Management */}
          <section id="san-management" className="manual-section">
            <h2>SAN Management</h2>
            <p>Manage your Storage Area Network infrastructure including switches, fabrics, zones, and aliases.</p>
          </section>

          <section id="san-overview" className="manual-section">
            <h3>SAN Overview</h3>
            <p>
              The SAN section allows you to manage Fibre Channel infrastructure for Cisco MDS and Brocade switches.
            </p>
            <p><strong>Key Concepts:</strong></p>
            <ul>
              <li><strong>Switch:</strong> Physical SAN switch device (Cisco or Brocade)</li>
              <li><strong>Fabric:</strong> Logical grouping of interconnected switches</li>
              <li><strong>Alias:</strong> Named group of WWPNs (World Wide Port Names)</li>
              <li><strong>Zone:</strong> Access control configuration defining which aliases can communicate</li>
            </ul>
          </section>

          <section id="switches" className="manual-section">
            <h3>Managing Switches</h3>
            <p>Navigate to <strong>SAN → Switches</strong> to manage SAN switch devices.</p>

            <h4>Adding a Switch</h4>
            <ol>
              <li>Click <strong>Add New</strong></li>
              <li>Enter switch details:
                <ul>
                  <li><strong>Name:</strong> Unique switch identifier</li>
                  <li><strong>Vendor:</strong> Cisco or Brocade</li>
                  <li><strong>Model:</strong> Switch model (e.g., MDS 9148S)</li>
                  <li><strong>IP Address:</strong> Management IP</li>
                  <li><strong>Location:</strong> Physical datacenter/rack location</li>
                  <li><strong>Serial Number:</strong> Hardware serial</li>
                  <li><strong>Firmware Version:</strong> Current firmware</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>
          </section>

          <section id="fabrics" className="manual-section">
            <h3>Managing Fabrics</h3>
            <p>Navigate to <strong>SAN → Fabrics</strong> to manage fabric configurations.</p>

            <h4>Creating a Fabric</h4>
            <ol>
              <li>Click <strong>Add New</strong></li>
              <li>Enter fabric details:
                <ul>
                  <li><strong>Name:</strong> Fabric name (e.g., "Fabric_A", "Production_SAN")</li>
                  <li><strong>Vendor:</strong> Cisco or Brocade</li>
                  <li><strong>Zone Set Name:</strong> Active zone set name</li>
                  <li><strong>VSAN:</strong> Virtual SAN ID (Cisco only)</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> Use consistent naming conventions for fabrics (e.g., Fabric_A, Fabric_B) to
              easily identify dual-fabric configurations.
            </div>
          </section>

          <section id="aliases" className="manual-section">
            <h3>Managing Aliases</h3>
            <p>Navigate to <strong>SAN → Aliases</strong> to manage device aliases and WWPNs.</p>

            <h4>Creating an Alias</h4>
            <ol>
              <li>Click <strong>Add New</strong></li>
              <li>Enter alias information:
                <ul>
                  <li><strong>Name:</strong> Alias name (e.g., "host01_hba0", "storage01_port1")</li>
                  <li><strong>Fabric:</strong> Select the fabric this alias belongs to</li>
                  <li><strong>Use:</strong> Initiator, Target, or Both</li>
                  <li><strong>WWPN(s):</strong> One or more World Wide Port Names</li>
                </ul>
              </li>
              <li>To add additional WWPNs:
                <ul>
                  <li>Click <strong>Add WWPN Column</strong> to add more WWPN fields</li>
                  <li>Enter each WWPN in the format: <code>50:01:23:45:67:89:AB:CD</code></li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <h4>WWPN Format</h4>
            <p>WWPNs must be in the format: <code>XX:XX:XX:XX:XX:XX:XX:XX</code> (16 hexadecimal characters with colons)</p>

            <div className="tip-box">
              <strong>Tip:</strong> Use the <strong>WWPN Colonizer</strong> tool (Tools → WWPN Colonizer) to format
              multiple WWPNs at once.
            </div>
          </section>

          <section id="zones" className="manual-section">
            <h3>Managing Zones</h3>
            <p>Navigate to <strong>SAN → Zones</strong> to manage zone configurations.</p>

            <h4>Creating a Zone</h4>
            <ol>
              <li>Click <strong>Add New</strong></li>
              <li>Enter zone information:
                <ul>
                  <li><strong>Name:</strong> Zone name</li>
                  <li><strong>Fabric:</strong> Select the fabric</li>
                  <li><strong>Zone Type:</strong> Standard or Smart</li>
                  <li><strong>Members:</strong> Select aliases to include in this zone</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <h4>Zone Best Practices</h4>
            <ul>
              <li>Use <strong>single-initiator zoning</strong> (one host alias to one or more target aliases)</li>
              <li>Name zones descriptively (e.g., "host01_to_storage01")</li>
              <li>Document zone purposes in the Notes field</li>
              <li>Regularly audit zones to remove unused configurations</li>
            </ul>
          </section>

          {/* Storage Management */}
          <section id="storage-management" className="manual-section">
            <h2>Storage Management</h2>
            <p>Manage storage systems, volumes, hosts, and ports.</p>
          </section>

          <section id="storage-overview" className="manual-section">
            <h3>Storage Overview</h3>
            <p>The Storage section provides comprehensive management of enterprise storage systems.</p>
            <p><strong>Key Components:</strong></p>
            <ul>
              <li><strong>Storage Systems:</strong> Physical storage arrays (DS8000, FlashSystem, etc.)</li>
              <li><strong>Volumes:</strong> Logical units (LUNs) provisioned from storage systems</li>
              <li><strong>Hosts:</strong> Servers connected to storage</li>
              <li><strong>Ports:</strong> FC and Ethernet ports on storage systems</li>
            </ul>
          </section>

          <section id="storage-systems" className="manual-section">
            <h3>Storage Systems</h3>
            <p>Navigate to <strong>Storage → Systems</strong> to view all storage systems.</p>

            <h4>Viewing Storage System Details</h4>
            <ol>
              <li>Click on any storage system name in the table</li>
              <li>The detail page shows comprehensive information organized in categories:
                <ul>
                  <li><strong>Basic Info:</strong> Name, vendor, model, serial, location</li>
                  <li><strong>Network:</strong> IP addresses, WWNN, management URL</li>
                  <li><strong>Capacity:</strong> Total, used, available, provisioned capacity</li>
                  <li><strong>Efficiency:</strong> Compression and deduplication ratios</li>
                  <li><strong>Performance:</strong> Cache size, I/O metrics</li>
                  <li><strong>Counts:</strong> Number of volumes, hosts, ports, pools</li>
                </ul>
              </li>
            </ol>

            <h4>Navigating to Related Data</h4>
            <p>From the storage system detail page, use the left sidebar to view:</p>
            <ul>
              <li><strong>Properties:</strong> All system properties</li>
              <li><strong>Volumes:</strong> Volumes on this system</li>
              <li><strong>Hosts:</strong> Hosts connected to this system</li>
              <li><strong>Ports:</strong> Ports on this system</li>
            </ul>
          </section>

          <section id="volumes" className="manual-section">
            <h3>Managing Volumes</h3>
            <p>View volumes either globally (<strong>Storage → Volumes</strong>) or per-system.</p>

            <h4>Volume Information</h4>
            <p>Volume records include:</p>
            <ul>
              <li><strong>Name/ID:</strong> Volume identifier</li>
              <li><strong>Storage System:</strong> Parent storage system</li>
              <li><strong>Capacity:</strong> Provisioned and used capacity</li>
              <li><strong>Pool:</strong> Storage pool assignment</li>
              <li><strong>Format:</strong> Volume format (CKD, FB, etc.)</li>
              <li><strong>Mapped Hosts:</strong> Hosts with access to this volume</li>
            </ul>

            <h4>Filtering Volumes</h4>
            <ul>
              <li>Use the <strong>Storage System</strong> filter to show volumes from specific systems</li>
              <li>Use the <strong>Search</strong> box to find volumes by name</li>
              <li>Click column headers to sort</li>
            </ul>
          </section>

          <section id="hosts" className="manual-section">
            <h3>Managing Hosts</h3>
            <p>Navigate to <strong>Storage → Hosts</strong> to manage host connections.</p>

            <h4>Creating a Host</h4>
            <ol>
              <li>Click <strong>Add New</strong></li>
              <li>Enter host details:
                <ul>
                  <li><strong>Name:</strong> Host name</li>
                  <li><strong>Storage System:</strong> Parent storage system</li>
                  <li><strong>Host Type:</strong> Host type/OS</li>
                  <li><strong>WWPNs:</strong> Host HBA WWPNs</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <div className="info-box">
              <strong>Note:</strong> WWPNs can be entered manually or will be automatically populated when importing
              from IBM Storage Insights.
            </div>
          </section>

          <section id="ports" className="manual-section">
            <h3>Managing Ports</h3>
            <p>Navigate to <strong>Storage → Ports</strong> to view storage system ports.</p>

            <h4>Port Information</h4>
            <p>Port records display:</p>
            <ul>
              <li><strong>Name:</strong> Port identifier</li>
              <li><strong>Type:</strong> Fibre Channel or Ethernet</li>
              <li><strong>WWPN:</strong> Port WWPN (for FC ports)</li>
              <li><strong>Speed:</strong> Port speed in Gbps</li>
              <li><strong>Protocol:</strong> FICON, SCSI FCP, NVMe, iSCSI, etc.</li>
              <li><strong>Use:</strong> Host connectivity or replication</li>
              <li><strong>Fabric Assignment:</strong> Optional fabric linkage</li>
            </ul>

            <h4>Linking Ports to Aliases</h4>
            <p>
              Storage ports can be linked to SAN aliases to create unified visibility between storage and fabric
              configurations. This helps track which storage ports are zoned to which hosts.
            </p>
          </section>

          {/* Script Generation */}
          <section id="scripts" className="manual-section">
            <h2>Script Generation</h2>
            <p>Generate automation scripts for SAN and storage configuration.</p>
          </section>

          <section id="scripts-overview" className="manual-section">
            <h3>Scripts Overview</h3>
            <p>
              Sanbox can generate ready-to-use scripts for various platforms, saving time and reducing errors
              in configuration deployment.
            </p>
            <p>Available script generators:</p>
            <ul>
              <li><strong>SAN Zoning Scripts:</strong> Cisco and Brocade zone creation/deletion</li>
              <li><strong>DS8000 Scripts:</strong> IBM DS8000 DSCLI commands</li>
              <li><strong>FlashSystem Scripts:</strong> IBM FlashSystem commands</li>
            </ul>
          </section>

          <section id="san-scripts" className="manual-section">
            <h3>SAN Zoning Scripts</h3>
            <p>Navigate to <strong>Scripts → SAN Zoning Scripts</strong>.</p>

            <h4>Generating Zone Creation Scripts</h4>
            <ol>
              <li>Select the <strong>Fabric</strong> from the dropdown</li>
              <li>The system automatically detects whether the fabric is Cisco or Brocade</li>
              <li>Use the search box to filter zones by name</li>
              <li>Select zones to include in the script (or select all)</li>
              <li>Click <strong>Generate Script</strong></li>
              <li>Review the generated commands</li>
              <li>Click <strong>Copy to Clipboard</strong> or <strong>Download</strong></li>
            </ol>

            <h4>Generating Zone Deletion Scripts</h4>
            <ol>
              <li>Switch to the <strong>Zone Deletion</strong> tab</li>
              <li>Follow the same process to select zones</li>
              <li>Generate deletion commands</li>
            </ol>

            <div className="warning-box">
              <strong>Warning:</strong> Always review generated scripts carefully before executing them on production
              switches. Test in a lab environment first when possible.
            </div>
          </section>

          <section id="ds8000-scripts" className="manual-section">
            <h3>DS8000 Scripts</h3>
            <p>Navigate to <strong>Scripts → DS8000 DSCLI Scripts</strong>.</p>
            <p>Generate DSCLI commands for:</p>
            <ul>
              <li><strong>Volume Provisioning:</strong> Create volumes and pools</li>
              <li><strong>Safeguarded Copy:</strong> Configure immutable snapshots</li>
              <li><strong>Replication:</strong> Set up Copy Services (Metro Mirror, Global Mirror)</li>
            </ul>
          </section>

          <section id="flashsystem-scripts" className="manual-section">
            <h3>FlashSystem Scripts</h3>
            <p>Navigate to <strong>Scripts → FlashSystem Scripts</strong>.</p>
            <p>Generate CLI commands for IBM FlashSystem management including volume provisioning and host mapping.</p>
          </section>

          {/* Data Import */}
          <section id="data-import" className="manual-section">
            <h2>Data Import</h2>
            <p>Import SAN configurations and storage data into Sanbox.</p>
          </section>

          <section id="import-overview" className="manual-section">
            <h3>Import Overview</h3>
            <p>
              The Universal Importer provides a unified interface for importing data from multiple sources.
              All imports are processed asynchronously with real-time progress tracking.
            </p>
            <p><strong>Supported Import Types:</strong></p>
            <ul>
              <li><strong>SAN Configuration:</strong> Cisco and Brocade switch configs</li>
              <li><strong>Storage Insights:</strong> IBM Storage Insights API data</li>
            </ul>
          </section>

          <section id="san-import" className="manual-section">
            <h3>SAN Configuration Import</h3>
            <p>Navigate to <strong>Data Import → Universal Importer</strong>.</p>

            <h4>Step-by-Step SAN Import</h4>
            <ol>
              <li><strong>Step 1: Select Import Type</strong>
                <ul><li>Choose <strong>SAN Configuration Import</strong></li></ul>
              </li>
              <li><strong>Step 2: Provide Data Source</strong>
                <ul>
                  <li>Upload a file (switch config output)</li>
                  <li>Or paste the configuration text directly</li>
                  <li>Supported formats:
                    <ul>
                      <li>Cisco: <code>show tech-support</code>, <code>show running-config</code></li>
                      <li>Brocade: Equivalent fabric configuration outputs</li>
                    </ul>
                  </li>
                  <li>The system automatically detects the vendor</li>
                </ul>
              </li>
              <li><strong>Step 3: Preview Data</strong>
                <ul>
                  <li>Review detected fabrics, zones, and aliases</li>
                  <li>Select which items to import (use checkboxes)</li>
                  <li>Click <strong>Next</strong> when ready</li>
                </ul>
              </li>
              <li><strong>Step 4: Configure Import</strong>
                <ul>
                  <li>For multi-fabric configs, map each fabric to a name</li>
                  <li>Set zone set names and VSAN IDs (Cisco)</li>
                  <li>Choose conflict resolution:
                    <ul>
                      <li><strong>Skip:</strong> Skip duplicate aliases/zones</li>
                      <li><strong>Rename:</strong> Automatically rename duplicates</li>
                      <li><strong>Overwrite:</strong> Replace existing records</li>
                    </ul>
                  </li>
                  <li>Decide whether to create new fabrics or link to existing ones</li>
                </ul>
              </li>
              <li><strong>Step 5: Execute Import</strong>
                <ul>
                  <li>Click <strong>Start Import</strong></li>
                  <li>Monitor real-time progress with task breakdown</li>
                  <li>View logs as the import runs</li>
                  <li>When complete, review statistics (zones created, aliases created, etc.)</li>
                </ul>
              </li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> For large configurations, the import runs in the background. You can navigate
              away and check progress later in the Import Monitor.
            </div>
          </section>

          <section id="storage-import" className="manual-section">
            <h3>Storage Insights Import</h3>
            <p>Navigate to <strong>Data Import → Universal Importer</strong>.</p>

            <h4>Step-by-Step Storage Insights Import</h4>
            <ol>
              <li><strong>Step 1: Select Import Type</strong>
                <ul><li>Choose <strong>IBM Storage Insights Import</strong></li></ul>
              </li>
              <li><strong>Step 2: Enter API Credentials</strong>
                <ul>
                  <li>Enter your IBM Storage Insights <strong>Tenant ID</strong></li>
                  <li>Enter your <strong>API Key</strong></li>
                  <li>Click <strong>Connect</strong> to fetch storage systems</li>
                </ul>
              </li>
              <li><strong>Step 3: Preview Available Systems</strong>
                <ul>
                  <li>Review the list of storage systems in your Insights account</li>
                  <li>Select which systems to import (checkboxes)</li>
                  <li>Click <strong>Next</strong></li>
                </ul>
              </li>
              <li><strong>Step 4: Configure Import Options</strong>
                <ul>
                  <li>Choose what to import:
                    <ul>
                      <li><input type="checkbox" disabled checked /> Storage Systems</li>
                      <li><input type="checkbox" disabled checked /> Volumes</li>
                      <li><input type="checkbox" disabled checked /> Hosts</li>
                      <li><input type="checkbox" disabled checked /> Ports</li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li><strong>Step 5: Execute Import</strong>
                <ul>
                  <li>Click <strong>Start Import</strong></li>
                  <li>Monitor progress as data is fetched from the API</li>
                  <li>When complete, review statistics</li>
                </ul>
              </li>
            </ol>

            <div className="info-box">
              <strong>Note:</strong> IBM Storage Insights API credentials can be saved at the customer level for
              easier future imports. Go to Organization → Customers and edit the customer record to store credentials.
            </div>
          </section>

          <section id="import-monitor" className="manual-section">
            <h3>Import Monitor</h3>
            <p>Navigate to <strong>Data Import → Import History</strong> to view all import jobs.</p>

            <h4>Monitoring Imports</h4>
            <p>The Import Monitor shows:</p>
            <ul>
              <li><strong>Job Status:</strong> Pending, In Progress, Completed, Failed</li>
              <li><strong>Import Type:</strong> SAN or Storage Insights</li>
              <li><strong>Start/End Times:</strong> Job duration</li>
              <li><strong>Statistics:</strong> Number of items imported</li>
              <li><strong>Logs:</strong> Detailed operation logs (expand row to view)</li>
            </ul>

            <h4>Canceling an Import</h4>
            <ol>
              <li>Find the running import in the table</li>
              <li>Click the <strong>Cancel</strong> button</li>
              <li>Confirm the cancellation</li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> The Import Monitor auto-refreshes every 5 seconds when there are active imports.
            </div>
          </section>

          {/* Tools & Calculators */}
          <section id="tools" className="manual-section">
            <h2>Tools & Calculators</h2>
            <p>Use specialized tools for WWPN formatting, naming patterns, capacity calculations, and documentation.</p>
          </section>

          <section id="tools-overview" className="manual-section">
            <h3>Tools Overview</h3>
            <p>Sanbox includes several utility tools to help with common storage administration tasks:</p>
            <ul>
              <li><strong>WWPN Colonizer:</strong> Format and validate WWPN values</li>
              <li><strong>Custom Naming:</strong> Create naming pattern rules</li>
              <li><strong>Storage Calculators:</strong> Capacity and conversion calculators</li>
              <li><strong>Doc Builder:</strong> Generate implementation worksheets</li>
            </ul>
          </section>

          <section id="wwpn-colonizer" className="manual-section">
            <h3>WWPN Colonizer</h3>
            <p>Navigate to <strong>Tools → WWPN Colonizer</strong>.</p>

            <h4>Using the WWPN Colonizer</h4>
            <ol>
              <li>Paste a list of WWPNs (one per line, any format)</li>
              <li>The tool automatically:
                <ul>
                  <li>Validates each WWPN (16 hex characters)</li>
                  <li>Formats them with colons (<code>XX:XX:XX:XX:XX:XX:XX:XX</code>)</li>
                  <li>Highlights invalid entries in red</li>
                </ul>
              </li>
              <li>Toggle <strong>With Colons</strong> to switch between formats:
                <ul>
                  <li>With colons: <code>50:01:23:45:67:89:AB:CD</code></li>
                  <li>Without colons: <code>5001234567890ABCD</code></li>
                </ul>
              </li>
              <li>Click <strong>Copy All</strong> to copy all valid WWPNs to clipboard</li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> This tool is perfect for cleaning up WWPN lists from spreadsheets or equipment
              documentation before importing into Sanbox.
            </div>
          </section>

          <section id="custom-naming" className="manual-section">
            <h3>Custom Naming</h3>
            <p>Navigate to <strong>Tools → Custom Naming</strong>.</p>

            <h4>Creating a Naming Rule</h4>
            <ol>
              <li>Select the <strong>Customer</strong> this rule applies to</li>
              <li>Select the <strong>Table</strong> (currently: Zones)</li>
              <li>Build your naming pattern using:
                <ul>
                  <li><strong>Text:</strong> Type text and press Enter to add static text</li>
                  <li><strong>Column Values:</strong> Select a database field from the dropdown</li>
                  <li><strong>Custom Variables:</strong> Create and use custom variables</li>
                </ul>
              </li>
              <li>Example pattern: <code>zone_</code> + <code>{'{'} Fabric Name {'}'}</code> + <code>_</code> + <code>{'{'} Member 1 {'}'}</code></li>
              <li>Reorder pattern items using the arrow buttons</li>
              <li>Click <strong>Save Rule</strong></li>
            </ol>

            <h4>Creating Custom Variables</h4>
            <ol>
              <li>In the <strong>Custom Variables</strong> section, click <strong>Add Variable</strong></li>
              <li>Enter:
                <ul>
                  <li><strong>Name:</strong> Variable name (e.g., "environment", "datacenter")</li>
                  <li><strong>Value:</strong> The value (e.g., "prod", "dc1")</li>
                  <li><strong>Description:</strong> Optional description</li>
                </ul>
              </li>
              <li>Click <strong>Save</strong></li>
              <li>The variable is now available in the pattern builder</li>
            </ol>
          </section>

          <section id="calculators" className="manual-section">
            <h3>Storage Calculators</h3>
            <p>Navigate to <strong>Tools → Storage Calculators</strong>.</p>

            <h4>Available Calculators</h4>

            <h5>1. IBM 3390 Storage Calculator (Mainframe)</h5>
            <p>Calculate capacity for IBM System z mainframe storage.</p>
            <ul>
              <li><strong>Inputs:</strong> Disk model (MOD 1/3/9/27/54), cylinders, quantity</li>
              <li><strong>Outputs:</strong> Bytes, GB, TB</li>
              <li><strong>Use Case:</strong> Planning mainframe storage requirements</li>
            </ul>

            <h5>2. DS8K CKD Pool Calculator</h5>
            <p>Calculate IBM DS8000 CKD pool capacity.</p>
            <ul>
              <li><strong>Inputs:</strong> Cylinders, extent size (21 or 1113 cyl)</li>
              <li><strong>Outputs:</strong> Extents, GiB, TiB, GB, TB</li>
              <li><strong>Use Case:</strong> DS8000 capacity planning</li>
            </ul>

            <h5>3. IBM i Storage Calculator</h5>
            <p>Calculate IBM i (AS/400) storage capacity.</p>
            <ul>
              <li><strong>Inputs:</strong> Disk model (Protected/Unprotected), blocks, quantity</li>
              <li><strong>Outputs:</strong> Bytes, GB, TB</li>
              <li><strong>Use Case:</strong> IBM i system sizing</li>
            </ul>

            <h5>4. IBM i Block Converter</h5>
            <p>Convert between standard and IBM i 520-byte block volumes.</p>
            <ul>
              <li><strong>Inputs:</strong> Volume size in GiB or GB</li>
              <li><strong>Outputs:</strong> Equivalent size in the other unit</li>
              <li><strong>Use Case:</strong> Mapping SAN LUNs to IBM i volumes</li>
            </ul>

            <h5>5. General Storage Converter</h5>
            <p>Universal storage unit converter.</p>
            <ul>
              <li><strong>Inputs:</strong> Value and unit (Bytes, KB, MB, GB, TB, KiB, MiB, GiB, TiB, Mbps, Gbps)</li>
              <li><strong>Outputs:</strong> Converted value in target unit</li>
              <li><strong>Use Case:</strong> Any capacity or rate conversion</li>
            </ul>

            <h5>6. Data Replication Calculator</h5>
            <p>Estimate data replication/migration time.</p>
            <ul>
              <li><strong>Inputs:</strong> Total data size, transfer rate</li>
              <li><strong>Outputs:</strong> Estimated time (days, hours, minutes, seconds)</li>
              <li><strong>Use Case:</strong> Planning migrations and replication windows</li>
            </ul>

            <div className="tip-box">
              <strong>Tip:</strong> Use the category filter buttons to show only specific calculator types
              (Mainframe, IBM i, General, Replication). Hold Shift to select multiple categories.
            </div>
          </section>

          <section id="doc-builder" className="manual-section">
            <h3>Doc Builder (Worksheet Generator)</h3>
            <p>Navigate to <strong>Tools → Doc Builder</strong>.</p>

            <h4>Generating Implementation Worksheets</h4>
            <p>
              The Doc Builder creates professional Excel worksheets for equipment installation projects with
              comprehensive site details, infrastructure settings, and equipment configurations.
            </p>

            <h5>Step 1: Enter Project Information</h5>
            <ul>
              <li><strong>Client Name:</strong> Auto-filled from active customer</li>
              <li><strong>Project Name:</strong> Auto-filled from active project</li>
              <li><strong>Planned Installation Date:</strong> Select the date</li>
            </ul>

            <h5>Step 2: Add Sites</h5>
            <ol>
              <li>Click <strong>Add Site</strong> to create a new site tab</li>
              <li>Enter site information:
                <ul>
                  <li><strong>Site Name:</strong> Datacenter or location name</li>
                  <li><strong>Contact Info:</strong> Name, email, phone</li>
                  <li><strong>Address:</strong> Full site address</li>
                  <li><strong>Site Notes:</strong> Room, rack, access instructions</li>
                </ul>
              </li>
              <li>Configure infrastructure:
                <ul>
                  <li><strong>DNS Servers:</strong> Primary and secondary DNS</li>
                  <li><strong>NTP Server:</strong> Time synchronization server</li>
                  <li><strong>SMTP Server:</strong> Email server and port</li>
                </ul>
              </li>
              <li>Set network defaults:
                <ul>
                  <li><strong>Subnet Mask:</strong> Default for equipment at this site</li>
                  <li><strong>Gateway:</strong> Default gateway</li>
                </ul>
              </li>
            </ol>

            <h5>Step 3: Add Implementation Team Contacts</h5>
            <ol>
              <li>Select contacts from your organization</li>
              <li>Or click <strong>Create New Contact</strong> to add someone</li>
              <li>Each site can have multiple team members assigned</li>
            </ol>

            <h5>Step 4: Add Equipment</h5>
            <ol>
              <li>Click equipment type cards to select equipment categories</li>
              <li>For each equipment item, enter:
                <ul>
                  <li>Equipment-specific fields (model, serial, etc.)</li>
                  <li><strong>Subnet Mask:</strong> Override site default if needed</li>
                  <li><strong>Gateway:</strong> Override site default if needed</li>
                  <li><strong>VLAN:</strong> Network VLAN</li>
                </ul>
              </li>
              <li>Use <strong>Duplicate</strong> to create copies of equipment with similar settings</li>
              <li>Use <strong>Remove</strong> to delete equipment items</li>
            </ol>

            <h5>Step 5: Generate Worksheet</h5>
            <ol>
              <li>Click <strong>Generate Worksheet</strong></li>
              <li>The system creates an Excel file with:
                <ul>
                  <li>Cover page with project details</li>
                  <li>One sheet per site with all equipment and settings</li>
                  <li>Contact information</li>
                  <li>Network configurations</li>
                </ul>
              </li>
              <li>The file downloads automatically with a timestamped name</li>
            </ol>

            <h5>Templates</h5>
            <p>Save time by using templates:</p>
            <ul>
              <li><strong>Save Template:</strong> Save your current configuration for reuse</li>
              <li><strong>Load Template:</strong> Load a previously saved template</li>
            </ul>

            <div className="tip-box">
              <strong>Tip:</strong> Create templates for common deployment scenarios (e.g., "Standard 2-Site HA Setup")
              to speed up worksheet creation for similar projects.
            </div>
          </section>

          {/* Backup & Restore */}
          <section id="backup" className="manual-section">
            <h2>Backup & Restore</h2>
            <p>Protect your data with comprehensive backup and restore capabilities.</p>
          </section>

          <section id="backup-overview" className="manual-section">
            <h3>Backup Overview</h3>
            <p>Navigate to <strong>Settings → Backup & Restore</strong> from the top navigation bar.</p>
            <p>
              Sanbox provides enterprise-grade backup and restore functionality for your PostgreSQL database,
              including schema versioning, automatic safety backups, and integrity verification.
            </p>
            <p><strong>Key Features:</strong></p>
            <ul>
              <li><strong>Full Database Backups:</strong> Complete PostgreSQL dumps with metadata</li>
              <li><strong>Schema Tracking:</strong> Django migration state recording</li>
              <li><strong>Media Backup:</strong> Optional inclusion of uploaded files</li>
              <li><strong>Automatic Scheduling:</strong> Hourly or daily backup jobs</li>
              <li><strong>Pre-Restore Safety:</strong> Automatic backup before each restore</li>
              <li><strong>Integrity Verification:</strong> SHA256 checksums</li>
              <li><strong>Restore History:</strong> Complete audit trail</li>
            </ul>
          </section>

          <section id="create-backup" className="manual-section">
            <h3>Creating Backups</h3>

            <h4>Manual Backup</h4>
            <ol>
              <li>Click the <strong>Create Backup</strong> button</li>
              <li>Enter:
                <ul>
                  <li><strong>Name:</strong> Descriptive name (e.g., "Pre-Upgrade Backup")</li>
                  <li><strong>Description:</strong> Optional notes about this backup</li>
                  <li><strong>Include Media:</strong> Check to include uploaded files</li>
                </ul>
              </li>
              <li>Click <strong>Create</strong></li>
              <li>The backup runs in the background (typically 30 seconds to several minutes)</li>
              <li>Monitor progress in the backup list (auto-refreshes every 3 seconds)</li>
            </ol>

            <h4>What Gets Backed Up</h4>
            <ul>
              <li>All database tables and data (customers, SAN configs, storage data, etc.)</li>
              <li>Django migration state for each app</li>
              <li>Application version information (Git tag/commit)</li>
              <li>PostgreSQL version</li>
              <li>Table row counts for verification</li>
              <li>Media files (if selected)</li>
            </ul>

            <div className="info-box">
              <strong>Note:</strong> Backup metadata tables (BackupRecord, BackupLog, RestoreRecord, BackupConfiguration)
              are automatically excluded from backups to prevent corruption during restore.
            </div>
          </section>

          <section id="restore-backup" className="manual-section">
            <h3>Restoring Backups</h3>

            <h4>Restore Process</h4>
            <ol>
              <li>In the backup list, find the backup you want to restore</li>
              <li>Click the <strong>Restore</strong> button</li>
              <li>Review the restore confirmation dialog:
                <ul>
                  <li>Backup details (name, date, size)</li>
                  <li>Schema compatibility status</li>
                  <li>Any warnings about version differences</li>
                </ul>
              </li>
              <li>Configure restore options:
                <ul>
                  <li><strong>Restore Media:</strong> Restore uploaded files (if backup included media)</li>
                  <li><strong>Run Migrations:</strong> Automatically apply any missing migrations after restore</li>
                </ul>
              </li>
              <li>Click <strong>Confirm Restore</strong></li>
              <li>A <strong>pre-restore safety backup</strong> is automatically created first</li>
              <li>The restore process runs through these phases:
                <ul>
                  <li><strong>Validating:</strong> Checking backup integrity and compatibility</li>
                  <li><strong>Pre-Backup:</strong> Creating safety backup</li>
                  <li><strong>Restoring:</strong> Loading database from backup</li>
                  <li><strong>Migrating:</strong> Applying any needed migrations</li>
                  <li><strong>Completed:</strong> Restore successful</li>
                </ul>
              </li>
            </ol>

            <div className="warning-box">
              <strong>Warning:</strong> Restoring a backup will <strong>replace all current data</strong> in the database.
              The automatic pre-restore safety backup allows you to roll back if needed, but verify you're restoring
              the correct backup before proceeding.
            </div>

            <h4>Schema Compatibility</h4>
            <p>When restoring a backup, Sanbox checks:</p>
            <ul>
              <li><strong>Django Migration State:</strong> Compares migrations in backup vs. current code</li>
              <li><strong>Application Version:</strong> Compares app version at backup time vs. current</li>
              <li><strong>Database Structure:</strong> Validates table existence</li>
            </ul>
            <p>
              If the backup is from an older version, Sanbox will automatically run any missing migrations after
              restoring (if you selected "Run Migrations"). Compatibility warnings are shown in the restore dialog.
            </p>
          </section>

          <section id="backup-schedule" className="manual-section">
            <h3>Backup Scheduling</h3>

            <h4>Configuring Automatic Backups</h4>
            <ol>
              <li>Click <strong>Configure Schedule</strong></li>
              <li>Enable <strong>Automatic Backups</strong></li>
              <li>Select frequency:
                <ul>
                  <li><strong>Hourly:</strong> Backup every hour, on the hour</li>
                  <li><strong>Daily:</strong> Backup once per day at specified hour</li>
                </ul>
              </li>
              <li>If Daily, select the hour (0-23, in 24-hour format)</li>
              <li>Choose whether to include media files in automatic backups</li>
              <li>Set retention:
                <ul>
                  <li><strong>Retention Days:</strong> Keep backups for N days (0 = keep all)</li>
                  <li><strong>Max Backups:</strong> Keep at most N backups (0 = unlimited)</li>
                </ul>
              </li>
              <li>Click <strong>Save Configuration</strong></li>
            </ol>

            <h4>Next Scheduled Backup</h4>
            <p>
              When automatic backups are enabled, the configuration panel shows the next scheduled backup time.
              The backup will run automatically at that time using the Celery background task system.
            </p>

            <div className="tip-box">
              <strong>Best Practice:</strong> Enable daily backups at a low-traffic time (e.g., 2 AM). Set retention
              to 30 days to balance data protection with storage space.
            </div>
          </section>

          <section id="backup-dashboard" className="manual-section">
            <h3>Backup Dashboard</h3>
            <p>Navigate to the Backup Dashboard from the Backup Management page.</p>

            <h4>Dashboard Sections</h4>

            <h5>Statistics Cards</h5>
            <ul>
              <li><strong>Total Backups:</strong> All backup records</li>
              <li><strong>Completed:</strong> Successful backups</li>
              <li><strong>Failed:</strong> Failed backup attempts</li>
              <li><strong>In Progress:</strong> Currently running backups</li>
              <li><strong>Backup Success Rate:</strong> Percentage of successful backups</li>
              <li><strong>Restore Success Rate:</strong> Percentage of successful restores</li>
            </ul>

            <h5>Health Score</h5>
            <p>A 0-100 score based on:</p>
            <ul>
              <li>Recent backup success rate</li>
              <li>Time since last successful backup</li>
              <li>Presence of automatic backup schedule</li>
              <li>Recent restore success rate</li>
            </ul>
            <p>Color coding:</p>
            <ul>
              <li><strong className="text-success">Green (80-100):</strong> Healthy backup system</li>
              <li><strong className="text-warning">Yellow (60-79):</strong> Needs attention</li>
              <li><strong className="text-danger">Red (0-59):</strong> Critical issues</li>
            </ul>

            <h5>Recent Activity</h5>
            <p>Shows the 5 most recent backups and restores with status indicators.</p>

            <h5>Storage Usage</h5>
            <p>Displays total backup storage consumed and breakdown by backup.</p>

            <h5>Recommendations</h5>
            <p>Based on health analysis, the dashboard provides recommendations like:</p>
            <ul>
              <li>Enable automatic backups if not configured</li>
              <li>Create a backup if none exist or last backup is old</li>
              <li>Investigate recent failures</li>
              <li>Set up retention policies if storage is growing</li>
            </ul>
          </section>

          {/* Settings & Preferences */}
          <section id="settings" className="manual-section">
            <h2>Settings & Preferences</h2>
            <p>Customize Sanbox to fit your workflow.</p>
          </section>

          <section id="app-settings" className="manual-section">
            <h3>Application Settings</h3>
            <p>Navigate to <strong>Settings → App Settings</strong> from the top navigation bar.</p>

            <h4>Available Settings</h4>
            <ul>
              <li><strong>Theme:</strong> Light or Dark mode</li>
              <li><strong>Items Per Page:</strong> Default table page size (25, 50, 100, 250)</li>
              <li><strong>Compact Mode:</strong> Reduce spacing in tables and forms</li>
              <li><strong>Auto-Refresh:</strong> Enable automatic data refresh</li>
              <li><strong>Auto-Refresh Interval:</strong> Refresh interval in seconds</li>
              <li><strong>Notifications:</strong> Enable browser notifications</li>
              <li><strong>Show Advanced Features:</strong> Display debugging tools</li>
            </ul>

            <p>Settings are saved automatically when you change them and persist across sessions.</p>
          </section>

          <section id="user-profile" className="manual-section">
            <h3>User Profile</h3>
            <p>Click your username in the top navigation bar and select <strong>My Profile</strong>.</p>

            <h4>Profile Information</h4>
            <ul>
              <li><strong>Username:</strong> Your login username (read-only)</li>
              <li><strong>Email:</strong> Your email address (editable)</li>
              <li><strong>Join Date:</strong> Account creation date</li>
            </ul>

            <h4>Changing Your Password</h4>
            <ol>
              <li>Enter your <strong>Current Password</strong></li>
              <li>Enter your <strong>New Password</strong> (minimum 8 characters)</li>
              <li>Re-enter your new password in <strong>Confirm Password</strong></li>
              <li>Click <strong>Change Password</strong></li>
            </ol>

            <div className="tip-box">
              <strong>Tip:</strong> Use a strong password with a mix of uppercase, lowercase, numbers, and symbols.
            </div>
          </section>

          <section id="table-preferences" className="manual-section">
            <h3>Table Preferences</h3>
            <p>
              Every table in Sanbox remembers your preferences including visible columns, column widths, filters,
              sorting, and page size. These settings are saved per-table and per-customer.
            </p>

            <h4>Customizing Tables</h4>
            <ul>
              <li><strong>Show/Hide Columns:</strong> Click the column visibility icon (eye) in the table toolbar</li>
              <li><strong>Reorder Columns:</strong> Drag column headers to reorder</li>
              <li><strong>Resize Columns:</strong> Drag the edge of column headers</li>
              <li><strong>Set Page Size:</strong> Use the page size dropdown (25, 50, 100, 250, All)</li>
              <li><strong>Apply Filters:</strong> Use filter dropdowns and search boxes</li>
              <li><strong>Sort:</strong> Click column headers to sort ascending/descending</li>
            </ul>

            <p>
              All preferences are automatically saved and will be restored the next time you visit that table
              for the same customer.
            </p>

            <div className="tip-box">
              <strong>Tip:</strong> If you want to reset a table to default settings, use the "Reset" button
              in the table toolbar (if available) or clear your table preferences in App Settings.
            </div>
          </section>

          {/* Working with Tables */}
          <section id="tables" className="manual-section">
            <h2>Working with Tables</h2>
            <p>Learn about the powerful table features available throughout Sanbox.</p>
          </section>

          <section id="table-features" className="manual-section">
            <h3>Table Features</h3>
            <p>
              All data tables in Sanbox use the TanStack CRUD Table component, providing a consistent and powerful
              interface for data management.
            </p>

            <h4>Core Features</h4>
            <ul>
              <li><strong>Server-Side Pagination:</strong> Efficiently handle large datasets</li>
              <li><strong>Multi-Column Sorting:</strong> Click headers to sort</li>
              <li><strong>Advanced Filtering:</strong> Text search and dropdown filters</li>
              <li><strong>Column Management:</strong> Show, hide, reorder, and resize columns</li>
              <li><strong>CRUD Operations:</strong> Create, Read, Update, Delete records</li>
              <li><strong>Bulk Operations:</strong> Select multiple rows for bulk actions</li>
              <li><strong>Export:</strong> Export to Excel or CSV</li>
              <li><strong>Inline Editing:</strong> Edit cells directly (double-click)</li>
              <li><strong>Responsive Design:</strong> Works on desktop, tablet, and mobile</li>
            </ul>
          </section>

          <section id="table-filtering" className="manual-section">
            <h3>Filtering & Searching</h3>

            <h4>Global Search</h4>
            <p>
              Use the search box above the table to search across all columns. As you type, the table filters in
              real-time to show only matching records.
            </p>

            <h4>Column-Specific Filters</h4>
            <p>Many tables provide dropdown filters for specific columns like:</p>
            <ul>
              <li><strong>Status filters:</strong> Active, Inactive, All</li>
              <li><strong>Vendor filters:</strong> Cisco, Brocade, All</li>
              <li><strong>Type filters:</strong> Storage type, host type, etc.</li>
            </ul>

            <h4>Combining Filters</h4>
            <p>
              You can combine the global search with column filters. For example, search for "prod" and filter by
              vendor "Cisco" to find all Cisco devices with "prod" in their name.
            </p>

            <h4>Clearing Filters</h4>
            <p>
              Click the "Clear Filters" button or clear the search box to reset all filters and show all records.
            </p>
          </section>

          <section id="table-export" className="manual-section">
            <h3>Exporting Data</h3>

            <h4>Export Options</h4>
            <ol>
              <li>Click the <strong>Export</strong> button in the table toolbar</li>
              <li>Choose format:
                <ul>
                  <li><strong>Excel (.xlsx):</strong> Formatted spreadsheet with styled headers</li>
                  <li><strong>CSV (.csv):</strong> Plain text comma-separated values</li>
                </ul>
              </li>
              <li>Choose scope:
                <ul>
                  <li><strong>All Data:</strong> Export all records (ignores filters)</li>
                  <li><strong>Filtered Data:</strong> Export only filtered/searched records</li>
                  <li><strong>Selected Rows:</strong> Export only selected rows</li>
                </ul>
              </li>
              <li>Click <strong>Export</strong></li>
            </ol>

            <h4>Excel Export Features</h4>
            <ul>
              <li>Auto-sized columns for readability</li>
              <li>Styled headers with bold text and background color</li>
              <li>Proper formatting (dates, booleans, numbers)</li>
              <li>Metadata sheet with export details (timestamp, filters, etc.)</li>
            </ul>

            <div className="tip-box">
              <strong>Tip:</strong> To export specific data, first apply filters or select specific rows, then
              choose "Filtered Data" or "Selected Rows" when exporting.
            </div>
          </section>

          <section id="table-editing" className="manual-section">
            <h3>Editing Records</h3>

            <h4>Inline Editing</h4>
            <ol>
              <li>Double-click any editable cell in the table</li>
              <li>The cell becomes an input field</li>
              <li>Make your changes</li>
              <li>Press <strong>Enter</strong> or click outside the cell to save</li>
              <li>Press <strong>Escape</strong> to cancel</li>
            </ol>

            <h4>Form Editing</h4>
            <ol>
              <li>Click the <strong>Edit</strong> icon (pencil) in the row actions</li>
              <li>A form modal appears with all fields</li>
              <li>Make your changes</li>
              <li>Click <strong>Save</strong> to commit changes</li>
              <li>Click <strong>Cancel</strong> to discard changes</li>
            </ol>

            <h4>Creating New Records</h4>
            <ol>
              <li>Click the <strong>Add New</strong> button above the table</li>
              <li>Fill in the required fields (marked with *)</li>
              <li>Fill in optional fields as needed</li>
              <li>Click <strong>Save</strong></li>
            </ol>

            <h4>Deleting Records</h4>
            <ol>
              <li>Select one or more rows using the checkboxes</li>
              <li>Click the <strong>Delete</strong> button</li>
              <li>Confirm the deletion in the dialog</li>
            </ol>

            <div className="warning-box">
              <strong>Warning:</strong> Deletions are permanent and cannot be undone. Some records cannot be deleted
              if they have dependent data (e.g., cannot delete a customer with existing projects).
            </div>

            <h4>Validation</h4>
            <p>Forms and inline editing include validation:</p>
            <ul>
              <li><strong>Required fields:</strong> Must be filled in before saving</li>
              <li><strong>Format validation:</strong> Email addresses, IP addresses, WWPNs, etc.</li>
              <li><strong>Unique constraints:</strong> Names must be unique within scope</li>
              <li><strong>Relational validation:</strong> Foreign keys must reference valid records</li>
            </ul>
            <p>Validation errors are shown in red below the field with specific error messages.</p>
          </section>

          {/* FAQ & Troubleshooting */}
          <section id="faq" className="manual-section">
            <h2>FAQ & Troubleshooting</h2>

            <h3>Frequently Asked Questions</h3>

            <h4>Q: Why don't I see any data in the tables?</h4>
            <p>
              <strong>A:</strong> Make sure you have selected an active Customer and Project in the context selector
              (top navigation bar). All data is scoped to your active context. If you still don't see data, you may
              need to import data first.
            </p>

            <h4>Q: How do I import data into Sanbox?</h4>
            <p>
              <strong>A:</strong> Use the Universal Importer (Data Import → Universal Importer). Choose either SAN
              Configuration Import (for Cisco/Brocade configs) or IBM Storage Insights Import (for storage data).
              See the Data Import section of this manual for detailed instructions.
            </p>

            <h4>Q: Can I undo a delete operation?</h4>
            <p>
              <strong>A:</strong> No, deletions are permanent. However, if you have recent backups, you can restore
              from a backup to recover deleted data. It's recommended to create a backup before making bulk deletions.
            </p>

            <h4>Q: Why is my import taking so long?</h4>
            <p>
              <strong>A:</strong> Large imports (especially from IBM Storage Insights with many storage systems) can
              take several minutes. The import runs in the background, so you can navigate away and check progress
              in the Import Monitor (Data Import → Import History). The page auto-refreshes every 5 seconds.
            </p>

            <h4>Q: How do I change the active customer/project?</h4>
            <p>
              <strong>A:</strong> Click the context indicator in the top navigation bar, or go to Settings → Project
              Configuration. Select your desired customer and project, then click Save.
            </p>

            <h4>Q: Why can't I edit certain fields?</h4>
            <p>
              <strong>A:</strong> Some fields are read-only, especially those populated by imports (e.g., storage
              system capacity metrics from IBM Storage Insights). System-generated fields like IDs and timestamps
              are also read-only.
            </p>

            <h4>Q: How do I generate SAN zoning scripts?</h4>
            <p>
              <strong>A:</strong> Navigate to Scripts → SAN Zoning Scripts, select your fabric, choose zones, and
              click Generate Script. The system automatically detects whether to use Cisco or Brocade syntax based
              on the fabric's vendor setting.
            </p>

            <h4>Q: Can I access Sanbox from my phone?</h4>
            <p>
              <strong>A:</strong> Yes, Sanbox is responsive and works on mobile devices. On small screens, the
              sidebar collapses to a menu button, and tables scroll horizontally. However, for best experience,
              we recommend using a desktop or tablet.
            </p>

            <h4>Q: How do I add more WWPN columns to aliases?</h4>
            <p>
              <strong>A:</strong> In the Aliases table, click the "Add WWPN Column" button to add additional WWPN
              fields. Each alias can have multiple WWPNs. The table preserves your column configuration for future visits.
            </p>

            <h4>Q: What happens if a restore fails?</h4>
            <p>
              <strong>A:</strong> If a restore fails, Sanbox automatically creates a pre-restore safety backup before
              the restore begins. You can restore from that safety backup to return to the state before the failed
              restore attempt. Check the Restore History page for details and error messages.
            </p>

            <h3>Troubleshooting</h3>

            <h4>Problem: "Session expired" or "Not authenticated" errors</h4>
            <p><strong>Solution:</strong> Your session has timed out. Log out and log back in.</p>

            <h4>Problem: Import fails with "Connection error"</h4>
            <p><strong>Solution:</strong> For Storage Insights imports, verify your API key and tenant ID are correct
            in the customer record (Organization → Customers). Check network connectivity to IBM Storage Insights.</p>

            <h4>Problem: Script generation produces no output</h4>
            <p><strong>Solution:</strong> Ensure you have selected a fabric and that the fabric has zones configured.
            Check that the fabric's vendor is set correctly (Cisco or Brocade).</p>

            <h4>Problem: Table shows "No data available"</h4>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Verify you have the correct Customer and Project selected</li>
              <li>Check if any filters are applied and clear them</li>
              <li>Import data if you haven't already</li>
              <li>Verify you have permissions to view this data (contact administrator)</li>
            </ul>

            <h4>Problem: Backup creation fails</h4>
            <p><strong>Solution:</strong> Check disk space on the server. Backups require sufficient free space.
            Contact your system administrator to verify the backup directory is writable and has adequate space.</p>

            <h4>Problem: Can't find a specific feature</h4>
            <p><strong>Solution:</strong> Use the search function in this manual (top of sidebar). If you still
            can't find it, contact support or check the application's Help menu → About for contact information.</p>

            <h3>Getting Help</h3>
            <p>If you need additional assistance:</p>
            <ul>
              <li><strong>Admin Panel:</strong> If you're an administrator, access the Django Admin panel via
              Help → Admin Panel for advanced configuration</li>
              <li><strong>About Page:</strong> View version information and credits via Help → About</li>
              <li><strong>Contact Support:</strong> Contact your system administrator or Sanbox support team</li>
            </ul>

            <div className="info-box">
              <strong>Version Information:</strong> You can find the current Sanbox version and deployment information
              in the About page (Help → About in the top navigation bar).
            </div>
          </section>

        </article>
      </main>

      {/* TOC Sidebar - Right Side */}
      <aside className={`manual-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <BookOpen size={20} />
          <h2>Table of Contents</h2>
        </div>

        <nav className="toc-navigation">
          {tableOfContents.map(item => renderTOCItem(item))}
        </nav>
      </aside>
    </div>
  );
};

export default UserManual;
