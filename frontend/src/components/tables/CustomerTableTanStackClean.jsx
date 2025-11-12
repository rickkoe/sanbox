import React, { useMemo } from "react";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import { getTableColumns, getDefaultSort, getColumnHeaders } from "../../utils/tableConfigLoader";

// Storage Insights Portal Button Component - Reactive to credential changes
const StorageInsightsPortalButton = ({ tenant, apiKey }) => {
    // Check if both credentials are present and not empty
    const hasValidCredentials = Boolean(tenant && String(tenant).trim()) && Boolean(apiKey && String(apiKey).trim());

    const handleClick = () => {
        if (hasValidCredentials && tenant) {
            window.open(`https://insights.ibm.com/cui/${tenant}`, '_blank');
        }
    };

    const handleMouseEnter = (e) => {
        if (hasValidCredentials) {
            e.currentTarget.style.backgroundColor = 'var(--color-accent-muted)';
        }
    };

    const handleMouseLeave = (e) => {
        if (hasValidCredentials) {
            e.currentTarget.style.backgroundColor = 'var(--color-accent-subtle)';
        }
    };

    return (
        <div style={{ textAlign: 'center' }}>
            <button
                disabled={!hasValidCredentials}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{
                    padding: '6px 12px',
                    border: hasValidCredentials
                        ? '1px solid var(--color-accent-emphasis)'
                        : '1px solid var(--badge-border)',
                    borderRadius: '6px',
                    cursor: hasValidCredentials ? 'pointer' : 'not-allowed',
                    backgroundColor: hasValidCredentials
                        ? 'var(--color-accent-subtle)'
                        : 'var(--badge-bg)',
                    color: hasValidCredentials
                        ? 'var(--color-accent-fg)'
                        : 'var(--badge-text)',
                    fontSize: '13px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                    minWidth: '110px'
                }}
            >
                {hasValidCredentials ? 'Launch' : 'Not Available'}
            </button>
        </div>
    );
};

// Clean TanStack Table implementation for Customer management
const CustomerTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';

    // Load columns from centralized configuration
    const columns = useMemo(() => {
        return getTableColumns('customer', false); // Customer table doesn't have project view variations
    }, []);

    const colHeaders = useMemo(() => {
        return getColumnHeaders('customer', false);
    }, []);

    const defaultSort = getDefaultSort('customer');

    const NEW_CUSTOMER_TEMPLATE = {
        id: null,
        name: "",
        insights_tenant: "",
        insights_api_key: "",
        insights_portal: "",
        notes: ""
    };

    // Custom renderers for customer-specific display logic
    const customRenderers = {
        name: (rowData, td, row, col, prop, value) => {
            return value || "";
        },
        insights_api_key: (rowData, td, row, col, prop, value) => {
            // Always mask any non-empty API key value
            // Don't rely on rowData.id which may not be loaded yet on initial render
            if (value && String(value).trim().length > 0) {
                return "••••••••••••••••••••"; // Show asterisks as password-like display
            }
            return value || "";
        },
        insights_portal: (rowData, td, row, col, prop, value) => {
            const customer = rowData || {};
            // Pass credentials directly as props for clearer reactivity
            const tenant = customer.insights_tenant || '';
            const apiKey = customer.insights_api_key || '';

            // Create a hash of the credentials to use as key
            // This ensures React creates a new component instance when ANY credential changes
            const credentialsHash = `${tenant || 'EMPTY'}_${apiKey || 'EMPTY'}`;
            const componentKey = `portal-${row}-${credentialsHash}`;

            return {
                __isReactComponent: true,
                component: <StorageInsightsPortalButton key={componentKey} tenant={tenant} apiKey={apiKey} />
            };
        }
    };

    // No transform needed for customers - simple model
    const saveTransform = (rows) => rows.map(row => ({
        ...row,
        // No special transformations needed for customers
    }));

    return (
        <div className="modern-table-container">
            <TanStackCRUDTable
                // API Configuration
                apiUrl={`${API_URL}/api/customers/`}
                saveUrl={`${API_URL}/api/customers/`}
                deleteUrl={`${API_URL}/api/customers/delete/`}
                customerId={null} // Don't filter by customer - show all customers user has access to
                tableName="customers"

                // Column Configuration
                columns={columns}
                colHeaders={colHeaders}
                dropdownSources={{}} // No dropdowns in customer table
                newRowTemplate={NEW_CUSTOMER_TEMPLATE}
                defaultSort={defaultSort}

                // Data Processing
                preprocessData={null} // No preprocessing needed
                saveTransform={saveTransform}
                customRenderers={customRenderers}

                // Table Settings
                height="calc(100vh - 200px)"
                storageKey="customer-table-tanstack"

                // Event Handlers
                onSave={(result) => {
                    if (result.success) {
                        console.log('✅ Save successful:', result.message);
                    } else {
                        console.error('❌ Save failed:', result.message);
                        alert('Error saving changes: ' + result.message);
                    }
                }}
            />
        </div>
    );
};

export default CustomerTableTanStackClean;