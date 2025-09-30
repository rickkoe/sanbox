import React, { useRef, useContext, useState, useMemo } from "react";
import axios from "axios";
import TanStackCRUDTable from "./TanStackTable/TanStackCRUDTable";
import { ConfigContext } from "../../context/ConfigContext";

const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
];

// All possible fabric columns
const ALL_COLUMNS = [
  { data: "name", title: "Name", type: "text" },
  { data: "san_vendor", title: "Vendor", type: "select" },
  { data: "zoneset_name", title: "Zoneset Name", type: "text" },
  { data: "vsan", title: "VSAN", type: "number" },
  { data: "exists", title: "Exists", type: "boolean" },
  { data: "notes", title: "Notes", type: "text" }
];

const FabricTableTanStack = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const tableRef = useRef(null);

    // Get customer ID early so it can be used in URLs
    const customerId = config?.customer?.id;

    const NEW_FABRIC_TEMPLATE = {
        id: null,
        name: "",
        san_vendor: "",
        zoneset_name: "",
        vsan: null,
        exists: false,
        notes: ""
    };

    // API URL with customer filter for server pagination - reactive to customerId changes
    const fabricsApiUrl = useMemo(() => {
        if (customerId) {
            console.log(`🔗 FabricTableTanStack: Building API URL with customer filter: ${customerId}`);
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}`;
        } else {
            console.log(`🔗 FabricTableTanStack: Customer ID not available, using unfiltered URL`);
            return `${API_URL}/api/san/fabrics/`;
        }
    }, [customerId, API_URL]);

    const fabricDeleteApiUrl = `${API_URL}/api/san/fabrics/delete/`;

    const dropdownSources = {
        san_vendor: vendorOptions.map(o => o.name)
    };

    const customRenderers = {
        san_vendor: (value, row, rowIndex, column) => {
            const displayName = vendorOptions.find(v => v.code === value || v.name === value)?.name || value;
            return (
                <span style={{
                    backgroundColor: '#f8f9fa',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0'
                }}>
                    {displayName}
                </span>
            );
        },
        exists: (value) => (
            <div style={{ textAlign: 'center' }}>
                <span style={{
                    color: value ? '#27ae60' : '#e74c3c',
                    fontWeight: '600',
                    fontSize: '16px'
                }}>
                    {value ? '✓' : '✗'}
                </span>
            </div>
        ),
        vsan: (value) => (
            <span style={{
                fontFamily: 'monospace',
                textAlign: 'center',
                color: value ? '#2c3e50' : '#999',
                fontStyle: value ? 'normal' : 'italic'
            }}>
                {value || '—'}
            </span>
        )
    };

    const saveTransform = (rows) =>
        rows
            .filter(row => {
                const requiredFields = ["name", "zoneset_name", "san_vendor"];
                return requiredFields.some(key => {
                    const value = row[key];
                    return typeof value === "string" && value.trim() !== "";
                });
            })
            .map(row => {
                console.log("Transforming row:", row);
                return {
                    ...row,
                    customer: config?.customer?.id,
                    san_vendor: vendorOptions.find(v => v.name === row.san_vendor || v.code === row.san_vendor)?.code || row.san_vendor,
                    vsan: row.vsan === "" || row.vsan === null ? null : row.vsan
                };
            });

    // Process data for display - convert vendor codes to names
    const preprocessData = (data) => {
        return data.map(fabric => ({
            ...fabric,
            san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
        }));
    };

    // Custom save handler
    const handleSave = async (unsavedData) => {
        try {
            console.log('🔄 TanStackTable FabricTable: Starting save operation with data:', unsavedData);
            const errors = [];
            const successes = [];

            for (const fabric of unsavedData) {
                try {
                    const payload = { ...fabric };
                    delete payload.saved;
                    delete payload._isNew;

                    // Apply the same transformations as saveTransform
                    payload.customer = config?.customer?.id;
                    payload.san_vendor = vendorOptions.find(v => v.name === payload.san_vendor || v.code === payload.san_vendor)?.code || payload.san_vendor;
                    payload.vsan = payload.vsan === "" || payload.vsan === null ? null : payload.vsan;

                    console.log('💾 Saving fabric payload:', payload);

                    if (fabric.id) {
                        // Update existing fabric
                        const response = await axios.put(`${API_URL}/api/san/fabrics/${fabric.id}/`, payload);
                        successes.push(response.data.message || `Updated ${fabric.name} successfully`);
                    } else {
                        // Create new fabric
                        delete payload.id;
                        const response = await axios.post(`${API_URL}/api/san/fabrics/`, payload);
                        successes.push(response.data.message || `Created ${fabric.name} successfully`);
                    }
                } catch (error) {
                    console.error('❌ Error saving fabric:', error.response?.data);
                    errors.push({
                        fabric: fabric.name || 'New Fabric',
                        error: error.response?.data || error.message
                    });
                }
            }

            if (errors.length > 0) {
                const errorMessages = errors.map(e => `${e.fabric}: ${JSON.stringify(e.error)}`).join('\n');
                return {
                    success: false,
                    message: `Errors saving fabrics:\n${errorMessages}`
                };
            }

            return {
                success: true,
                message: successes.length > 0 ? successes.join(', ') : 'No changes to save'
            };
        } catch (error) {
            console.error('❌ General save error:', error);
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    };

    // Custom delete handler
    const handleDelete = async (rowId) => {
        try {
            console.log('🗑️ TanStackTable FabricTable: Deleting fabric ID:', rowId);
            const response = await axios.delete(`${API_URL}/api/san/fabrics/${rowId}/`);
            return {
                success: true,
                message: response.data.message || `Fabric deleted successfully`
            };
        } catch (error) {
            console.error('❌ Error deleting fabric:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || 'Failed to delete fabric'
            };
        }
    };

    // Show loading while config is being fetched
    if (configLoading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading configuration...</span>
                    </div>
                    <span className="ms-2">Loading customer configuration...</span>
                </div>
            </div>
        );
    }

    const additionalButtons = [
        {
            label: 'Refresh',
            icon: '🔄',
            onClick: () => {
                console.log('🔄 Manual refresh triggered');
                if (tableRef.current?.refresh) {
                    tableRef.current.refresh();
                }
            },
            variant: 'secondary'
        },
        {
            label: 'Auto-size Columns',
            icon: '📏',
            onClick: () => {
                console.log('📏 Auto-sizing columns');
                if (tableRef.current?.autoSizeColumns) {
                    tableRef.current.autoSizeColumns({ force: true });
                }
            },
            variant: 'secondary'
        }
    ];

    return (
        <div className="modern-table-container">
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px', border: '1px solid #3498db' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>🚀 TanStack Table Test - Fabric Management</h4>
                <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                    This is the TanStack Table implementation of FabricTable. Test all features: sorting, filtering,
                    copy/paste, fill operations, keyboard navigation, export, and server-side operations.
                </p>
                {customerId && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#666' }}>
                        <strong>Customer:</strong> {config?.customer?.name} (ID: {customerId})
                    </p>
                )}
            </div>

            <TanStackCRUDTable
                ref={tableRef}

                // Data and API
                apiUrl={fabricsApiUrl}
                saveUrl={fabricsApiUrl}
                deleteUrl={fabricDeleteApiUrl}

                // Column configuration
                columns={ALL_COLUMNS}
                colHeaders={ALL_COLUMNS.map(col => col.title)}
                dropdownSources={dropdownSources}
                customRenderers={customRenderers}

                // Table behavior
                serverPagination={true}
                defaultPageSize={'All'}
                enableVirtualization={true}
                enableRowSelection={true}
                enableFiltering={true}
                enableSorting={true}
                enableExport={true}

                // Excel-like features
                enableCopyPaste={true}
                enableFillOperations={true}
                enableKeyboardNavigation={true}

                // Editing
                enableEditing={false} // Can be enabled for inline editing
                newRowTemplate={NEW_FABRIC_TEMPLATE}

                // Events
                onSave={handleSave}
                onDelete={handleDelete}
                onDataChange={(changes) => {
                    console.log('📝 Data changed:', changes);
                }}
                onSelectionChange={(selection) => {
                    console.log('🎯 Selection changed:', selection?.length || 0, 'items');
                }}

                // Data processing
                preprocessData={preprocessData}
                saveTransform={saveTransform}

                // UI customization
                height="600px"
                storageKey={`fabric-table-tanstack-${customerId || 'default'}`}
                tableName="fabrics_tanstack"
                additionalButtons={additionalButtons}
                getExportFilename={() => `${config?.customer?.name || 'Customer'}_Fabric_Table_TanStack.csv`}
            />

            {/* Performance comparison info */}
            <div style={{
                marginTop: '20px',
                padding: '15px',
                backgroundColor: '#f0f8e8',
                borderRadius: '8px',
                border: '1px solid #27ae60'
            }}>
                <h5 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>⚡ Performance Test Instructions</h5>
                <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
                    <li><strong>Excel Features:</strong> Try copy/paste (Ctrl+C/V), fill operations (Ctrl+D/R), arrow navigation</li>
                    <li><strong>Filtering:</strong> Use global search or column filters - notice server-side filtering</li>
                    <li><strong>Sorting:</strong> Click column headers - server-side sorting with visual indicators</li>
                    <li><strong>Export:</strong> Test CSV and Excel export with different options</li>
                    <li><strong>Virtual Scrolling:</strong> Should be smooth even with many rows</li>
                    <li><strong>Save/Delete:</strong> Test CRUD operations with proper error handling</li>
                </ul>
            </div>
        </div>
    );
};

export default FabricTableTanStack;