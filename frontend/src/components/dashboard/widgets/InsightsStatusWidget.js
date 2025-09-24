import React, { useContext } from 'react';
import { 
  FaCloudUploadAlt, FaCheckCircle, FaTimesCircle, FaExclamationTriangle,
  FaKey, FaBuilding, FaExternalLinkAlt, FaCog
} from 'react-icons/fa';
import { ConfigContext } from '../../../context/ConfigContext';

const InsightsStatusWidget = ({ widget, editMode }) => {
  const { config } = useContext(ConfigContext);
  const customer = config?.customer;

  // Check if Storage Insights is configured
  const hasTenant = customer?.insights_tenant && customer.insights_tenant.trim() !== '';
  const hasApiKey = customer?.insights_api_key && customer.insights_api_key.trim() !== '';
  const isFullyConfigured = hasTenant && hasApiKey;

  // Generate Storage Insights portal URL if tenant exists
  const getPortalUrl = () => {
    if (!hasTenant) return null;
    return `https://insights.ibm.com/cui/${customer.insights_tenant}/dashboard`;
  };

  // Get overall status
  const getOverallStatus = () => {
    if (isFullyConfigured) {
      return {
        status: 'ready',
        message: 'Ready for data import',
        icon: FaCheckCircle,
        color: '#10b981'
      };
    } else if (hasTenant || hasApiKey) {
      return {
        status: 'partial',
        message: 'Partial configuration',
        icon: FaExclamationTriangle,
        color: '#f59e0b'
      };
    } else {
      return {
        status: 'not_configured',
        message: 'Not configured',
        icon: FaTimesCircle,
        color: '#ef4444'
      };
    }
  };

  const status = getOverallStatus();
  const portalUrl = getPortalUrl();

  if (editMode) {
    return (
      <div className="insights-status-widget preview">
        <div className="widget-header">
          <h4>IBM Storage Insights Status</h4>
        </div>
        <div className="status-preview">
          <div className="status-item">
            <FaBuilding className="status-icon ready" />
            <span>Tenant: configured</span>
          </div>
          <div className="status-item">
            <FaKey className="status-icon ready" />
            <span>API Key: configured</span>
          </div>
          <div className="overall-status ready">
            <FaCheckCircle />
            <span>Ready for import</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-status-widget">
      <div className="widget-header">
        <div className="header-left">
          <h4>{widget?.title || 'Storage Insights Status'}</h4>
        </div>
        {isFullyConfigured && portalUrl && (
          <a 
            href={portalUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="portal-link"
            title="Open Storage Insights Portal"
          >
            <FaExternalLinkAlt />
          </a>
        )}
      </div>

      <div className="status-content">
        {!customer ? (
          <div className="no-customer">
            <FaExclamationTriangle />
            <span>No customer selected</span>
          </div>
        ) : (
          <>
            {/* Configuration Status Items */}
            <div className="status-items">
              <div className="status-item">
                <div className="status-indicator">
                  <FaBuilding className={`status-icon ${hasTenant ? 'ready' : 'missing'}`} />
                  <span className="status-label">Tenant</span>
                </div>
                {hasTenant ? (
                  <FaCheckCircle className="check-icon ready" />
                ) : (
                  <FaTimesCircle className="check-icon missing" />
                )}
              </div>

              <div className="status-item">
                <div className="status-indicator">
                  <FaKey className={`status-icon ${hasApiKey ? 'ready' : 'missing'}`} />
                  <span className="status-label">API Key</span>
                </div>
                {hasApiKey ? (
                  <FaCheckCircle className="check-icon ready" />
                ) : (
                  <FaTimesCircle className="check-icon missing" />
                )}
              </div>
            </div>

            {/* Overall Status */}
            <div className={`overall-status ${status.status}`}>
              <div className="overall-details">
                <span className="overall-message">{status.message}</span>
                {isFullyConfigured && (
                  <span className="overall-description">
                    Data import from Storage Insights is available
                  </span>
                )}
                {status.status === 'partial' && (
                  <span className="overall-description">
                    {!hasTenant && 'Missing tenant configuration. '}
                    {!hasApiKey && 'Missing API key configuration.'}
                  </span>
                )}
                {status.status === 'not_configured' && (
                  <span className="overall-description">
                    Configure tenant and API key to enable data import
                  </span>
                )}
              </div>
            </div>

            {/* Portal Link */}
            {portalUrl && (
              <div className="portal-section">
                <a 
                  href={portalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="portal-button"
                >
                  <FaExternalLinkAlt />
                  Open Storage Insights Portal
                </a>
              </div>
            )}

            {/* Configuration Link */}
            <div className="config-section">
              <button className="config-button" title="Configure Storage Insights settings">
                <FaCog />
                Configure Settings
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InsightsStatusWidget;