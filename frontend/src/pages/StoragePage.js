import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Modal, Form, Alert, Spinner } from "react-bootstrap";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { useTheme } from "../context/ThemeContext";
import { Archive, Monitor, Cable, Database, HardDrive, Layers } from "lucide-react";
import "../styles/scriptspages.css";
import "../styles/storagepage.css";

// Field categories for organization
const FIELD_CATEGORIES = {
  "Basic Info": [
    'name', 'storage_type', 'vendor', 'serial_number', 'model', 'machine_type',
    'location', 'system_id', 'storage_system_id', 'uuid', 'condition'
  ],
  "Network": [
    'primary_ip', 'secondary_ip', 'wwnn', 'element_manager_url', 'time_zone'
  ],
  "Firmware & System": [
    'firmware_level', 'probe_status', 'pm_status', 'events_status', 'data_collection',
    'data_collection_type', 'probe_schedule', 'last_successful_probe', 'last_successful_monitor'
  ],
  "Capacity": [
    'capacity_bytes', 'used_capacity_bytes', 'used_capacity_percent',
    'available_capacity_bytes', 'available_system_capacity_bytes', 'available_system_capacity_percent',
    'raw_capacity_bytes', 'provisioned_capacity_bytes', 'provisioned_capacity_percent',
    'remaining_unallocated_capacity_bytes'
  ],
  "Mapped Capacity": [
    'mapped_capacity_bytes', 'mapped_capacity_percent', 'unmapped_capacity_bytes',
    'unmapped_capacity_percent', 'written_capacity_limit_bytes', 'used_written_capacity_bytes',
    'used_written_capacity_percent', 'available_written_capacity_bytes',
    'provisioned_written_capacity_percent', 'available_volume_capacity_bytes'
  ],
  "Efficiency & Savings": [
    'capacity_savings_bytes', 'capacity_savings_percent', 'deduplication_savings_bytes',
    'deduplication_savings_percent', 'data_reduction_savings_bytes', 'data_reduction_savings_percent',
    'data_reduction_ratio', 'total_compression_ratio', 'drive_compression_savings_percent',
    'pool_compression_savings_bytes', 'compressed'
  ],
  "Performance & Cache": [
    'read_cache_bytes', 'write_cache_bytes', 'overhead_capacity_bytes'
  ],
  "Counts": [
    'volumes_count', 'pools_count', 'disks_count', 'fc_ports_count', 'ip_ports_count',
    'host_connections_count', 'remote_relationships_count', 'unprotected_volumes_count',
    'managed_disks_count'
  ],
  "Security & Protection": [
    'safe_guarded_capacity_bytes', 'safeguarded_virtual_capacity_bytes',
    'safeguarded_used_capacity_percentage', 'ransomware_threat_detection',
    'threat_notification_recipients', 'callhome_system', 'acknowledged'
  ],
  "Power & Environment": [
    'current_power_usage_watts', 'system_temperature_celsius', 'system_temperature_Fahrenheit',
    'power_efficiency', 'co2_emission'
  ],
  "Growth & Trends": [
    'recent_fill_rate', 'recent_growth', 'shortfall_percent'
  ],
  "Customer Info": [
    'customer_number', 'customer_country_code', 'staas_environment'
  ]
};

// Default visible fields
const DEFAULT_VISIBLE_FIELDS = [
  'name', 'storage_type', 'vendor', 'serial_number',
  'location', 'firmware_level', 'condition',
  'capacity_bytes', 'used_capacity_percent', 'available_capacity_bytes'
];

const StoragePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [storage, setStorage] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);
  const { theme } = useTheme();

  // Field filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [visibleFields, setVisibleFields] = useState(DEFAULT_VISIBLE_FIELDS);
  const [searchText, setSearchText] = useState("");
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Collapsible category state
  const [collapsedCategories, setCollapsedCategories] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch storage data
        const response = await axios.get(`/api/storage/${id}/`);
        setStorage(response.data);
        setFormData(response.data);
        setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));

        // Fetch field preferences
        try {
          const prefsResponse = await axios.get(`/api/storage/${id}/field-preferences/`);
          if (prefsResponse.data.visible_columns && prefsResponse.data.visible_columns.length > 0) {
            setVisibleFields(prefsResponse.data.visible_columns);
          }
        } catch (prefError) {
          console.log("No saved preferences, using defaults");
        }

      } catch (error) {
        console.error("Failed to fetch storage system:", error);
        setError("Failed to load storage system details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, setBreadcrumbMap]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.patch(`/api/storage/${id}/`, formData);
      alert("Changes saved successfully.");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setLoadingPreferences(true);
      await axios.post(`/api/storage/${id}/field-preferences/`, {
        visible_columns: visibleFields
      });
      setShowFilterModal(false);
    } catch (error) {
      console.error("Failed to save preferences:", error);
      alert("Failed to save field preferences");
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleToggleField = (field) => {
    setVisibleFields(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else {
        return [...prev, field];
      }
    });
  };

  const handleSelectAllInCategory = (category, checked) => {
    const categoryFields = FIELD_CATEGORIES[category];
    setVisibleFields(prev => {
      if (checked) {
        // Add all fields from category
        const newFields = [...new Set([...prev, ...categoryFields])];
        return newFields;
      } else {
        // Remove all fields from category
        return prev.filter(f => !categoryFields.includes(f));
      }
    });
  };

  const handleResetToDefault = () => {
    setVisibleFields(DEFAULT_VISIBLE_FIELDS);
  };

  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === "") return "—";

    // Format bytes to GB/TB
    if (key.includes("_bytes")) {
      const bytes = parseInt(value);
      if (isNaN(bytes)) return value;
      const tb = bytes / (1024 ** 4);
      const gb = bytes / (1024 ** 3);
      if (tb >= 1) return `${tb.toFixed(2)} TB`;
      if (gb >= 1) return `${gb.toFixed(2)} GB`;
      return `${(bytes / (1024 ** 2)).toFixed(2)} MB`;
    }

    // Format percentages
    if (key.includes("_percent")) {
      return `${parseFloat(value).toFixed(2)}%`;
    }

    // Format booleans
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    return value;
  };

  const getFieldLabel = (key) => {
    return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const filterFields = () => {
    if (!searchText) return visibleFields;
    return visibleFields.filter(field =>
      getFieldLabel(field).toLowerCase().includes(searchText.toLowerCase())
    );
  };

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const getFieldsByCategory = () => {
    const categorizedFields = {};

    // Group visible fields by their categories
    Object.entries(FIELD_CATEGORIES).forEach(([category, fields]) => {
      const visibleInCategory = fields.filter(field => visibleFields.includes(field));
      if (visibleInCategory.length > 0) {
        categorizedFields[category] = visibleInCategory;
      }
    });

    return categorizedFields;
  };

  if (loading) return (
    <div className="scripts-page-container">
      <div className="loading-state">
        <Spinner animation="border" role="status" />
        <span>Loading storage system details...</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="scripts-page-container">
      <Alert variant="danger">{error}</Alert>
    </div>
  );

  if (!storage) return (
    <div className="scripts-page-container">
      <Alert variant="warning">Storage system not found.</Alert>
    </div>
  );

  const filteredFields = filterFields();

  return (
    <div className={`scripts-page-container theme-${theme}`}>
      {/* Page Header */}
      <div className="scripts-header">
        <div className="scripts-header-content">
          <div className="header-title-section">
            <button
              className="back-btn"
              onClick={() => navigate("/storage/systems")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <div>
              <h1 className="scripts-title">{storage.name} Properties</h1>
              <p className="scripts-description">
                {storage.storage_type} • {storage.vendor} • {storage.serial_number}
              </p>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="script-action-btn script-action-btn-secondary"
              onClick={() => setShowFilterModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14"/>
                <line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/>
                <line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/>
                <line x1="9" y1="8" x2="15" y2="8"/>
                <line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
              Field Filter
            </button>

            <button
              className="script-action-btn script-action-btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="btn-spinner"></div>
                  Saving...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17,21 17,13 7,13 7,21"/>
                    <polyline points="7,3 7,8 15,8"/>
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="scripts-content">
        {/* Database Statistics Dashboard */}
        <div className="storage-stats-dashboard">
          <h2 className="stats-dashboard-title">Database Statistics</h2>
          <div className="stats-cards-grid">
            <Link
              to={`/storage/${id}/volumes`}
              className="stat-card stat-card-clickable"
            >
              <div className="stat-icon">
                <Archive size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{storage.db_volumes_count || 0}</div>
                <div className="stat-label">Volumes</div>
              </div>
              <div className="stat-arrow">→</div>
            </Link>

            <Link
              to={`/storage/${id}/hosts`}
              className="stat-card stat-card-clickable"
            >
              <div className="stat-icon">
                <Monitor size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{storage.db_hosts_count || 0}</div>
                <div className="stat-label">Hosts</div>
              </div>
              <div className="stat-arrow">→</div>
            </Link>

            <Link
              to={`/storage/${id}/ports`}
              className="stat-card stat-card-clickable"
            >
              <div className="stat-icon">
                <Cable size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{storage.db_ports_count || 0}</div>
                <div className="stat-label">Ports</div>
              </div>
              <div className="stat-arrow">→</div>
            </Link>

            {/* Volume Ranges - DS8000 only */}
            {storage.storage_type === 'DS8000' && (
              <Link
                to={`/storage/${id}/volume-ranges`}
                className="stat-card stat-card-clickable"
              >
                <div className="stat-icon">
                  <Layers size={32} />
                </div>
                <div className="stat-content">
                  <div className="stat-value">Ranges</div>
                  <div className="stat-label">Volume Ranges</div>
                </div>
                <div className="stat-arrow">→</div>
              </Link>
            )}

            <div className="stat-card">
              <div className="stat-icon">
                <Database size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{storage.pools_count || 0}</div>
                <div className="stat-label">Pools</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <HardDrive size={32} />
              </div>
              <div className="stat-content">
                <div className="stat-value">{storage.disks_count || 0}</div>
                <div className="stat-label">Disks</div>
              </div>
            </div>
          </div>
        </div>

        {/* Properties Display - Grouped by Category */}
        <div className="storage-properties-section">
          <h2 className="properties-section-title">
            Storage Properties
            <span className="fields-count">({filteredFields.length} fields visible)</span>
          </h2>

          {Object.entries(getFieldsByCategory()).map(([category, fields]) => {
            const isCollapsed = collapsedCategories[category];

            return (
              <div key={category} className="property-category">
                <div
                  className="property-category-header"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="category-header-content">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`category-chevron ${isCollapsed ? 'collapsed' : ''}`}
                    >
                      <polyline points="6,9 12,15 18,9"/>
                    </svg>
                    <h3 className="category-title">{category}</h3>
                    <span className="category-count">({fields.length} fields)</span>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="properties-grid">
                    {fields.map((key) => {
                      const value = formData[key];
                      const isReadOnly = key === "id" || key.startsWith("db_");
                      const isBoolean = typeof value === "boolean";

                      return (
                        <div key={key} className="property-item">
                          <label className="property-label">{getFieldLabel(key)}</label>
                          {isBoolean ? (
                            <div className="property-value">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!formData[key]}
                                onChange={(e) => handleChange(key, e.target.checked)}
                                disabled={isReadOnly}
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              className={`property-input ${isReadOnly ? 'property-input-readonly' : ''}`}
                              value={formData[key] !== null && formData[key] !== undefined ? formData[key] : ""}
                              onChange={(e) => handleChange(key, e.target.value)}
                              readOnly={isReadOnly}
                              placeholder={formatValue(key, value)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Field Filter Modal */}
      <Modal
        show={showFilterModal}
        onHide={() => setShowFilterModal(false)}
        centered
        size="lg"
        className={`download-modal theme-${theme}`}
      >
        <Modal.Header closeButton className="download-modal-header">
          <Modal.Title>Field Filter</Modal.Title>
        </Modal.Header>
        <Modal.Body className="download-modal-body">
          <p className="field-filter-description">
            Choose which fields to display on the storage properties page. Your preferences will be saved.
          </p>

          {/* Search */}
          <div className="download-modal-section">
            <label className="download-modal-label">Search Fields</label>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="download-filename-input"
                placeholder="Search fields..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="search-clear-button"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Reset Button */}
          <div className="download-modal-section">
            <button
              className="modal-btn modal-btn-secondary reset-fields-button"
              onClick={handleResetToDefault}
            >
              Reset to Default Fields
            </button>
          </div>

          {/* Fields by Category */}
          {Object.entries(FIELD_CATEGORIES).map(([category, fields]) => {
            const filteredCategoryFields = fields.filter(field =>
              getFieldLabel(field).toLowerCase().includes(searchText.toLowerCase())
            );

            if (filteredCategoryFields.length === 0) return null;

            const allSelected = filteredCategoryFields.every(f => visibleFields.includes(f));
            const someSelected = filteredCategoryFields.some(f => visibleFields.includes(f));

            return (
              <div key={category} className="download-modal-section">
                <div className="select-all-header">
                  <Form.Check
                    type="checkbox"
                    id={`category-${category}`}
                    label={category}
                    checked={allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someSelected && !allSelected;
                      }
                    }}
                    onChange={(e) => handleSelectAllInCategory(category, e.target.checked)}
                    className="select-all-checkbox"
                  />
                  <span className="selection-count">
                    {filteredCategoryFields.filter(f => visibleFields.includes(f)).length} of {filteredCategoryFields.length}
                  </span>
                </div>

                <div className="fabric-list">
                  {filteredCategoryFields.map((field) => (
                    <div key={field} className="fabric-item">
                      <Form.Check
                        type="checkbox"
                        id={`field-${field}`}
                        checked={visibleFields.includes(field)}
                        onChange={() => handleToggleField(field)}
                        className="fabric-checkbox"
                      />
                      <label htmlFor={`field-${field}`} className="fabric-label">
                        <span className="fabric-name">{getFieldLabel(field)}</span>
                        <span className="fabric-tag">{field}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Modal.Body>
        <Modal.Footer className="download-modal-footer">
          <button
            className="modal-btn modal-btn-secondary"
            onClick={() => setShowFilterModal(false)}
            disabled={loadingPreferences}
          >
            Cancel
          </button>
          <button
            className="modal-btn modal-btn-primary"
            onClick={handleSavePreferences}
            disabled={loadingPreferences}
          >
            {loadingPreferences ? (
              <>
                <div className="btn-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                  <polyline points="17,21 17,13 7,13 7,21"/>
                  <polyline points="7,3 7,8 15,8"/>
                </svg>
                Save Preferences
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StoragePage;
