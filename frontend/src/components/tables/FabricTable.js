import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable, HotColumn } from '@handsontable/react-wrapper';
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Alert, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

// Vendor options for SAN vendor dropdown
const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
];

const FabricTable = () => {
    const { config, loading: configLoading } = useContext(ConfigContext);
    const [fabrics, setFabrics] = useState([]);
    const [unsavedFabrics, setUnsavedFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saveStatus, setSaveStatus] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [nextPath, setNextPath] = useState(null);
    const tableRef = useRef(null);
    const navigate = useNavigate();
    const fabricsForCustomerApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";
    const fabricSaveApiUrl = "http://127.0.0.1:8000/api/san/fabrics/save/";
    const fabricDeleteApiUrl = "http://127.0.0.1:8000/api/san/fabrics/delete/";
    
    useEffect(() => {
        if (config?.customer?.id) {
            fetchFabrics(config.customer.id);
        }
    }, [config]);

    // ✅ Ensure a blank row is always present
    const ensureBlankRow = (data) => {
        if (data.length === 0 || data[data.length - 1].name.trim() !== "") {
            return [...data, { id: null, name: "", san_vendor: "", zoneset_name: "", vsan: "", exists: false }];
        }
        return data;
    };

    // ✅ Fetch fabrics for the active customer
    const fetchFabrics = async (customerId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${fabricsForCustomerApiUrl}${customerId}/`);
            const fetched = response.data.map(fabric => ({
              ...fabric,
              san_vendor: vendorOptions.find(o => o.code === fabric.san_vendor)?.name || fabric.san_vendor
            }));
            const data = ensureBlankRow(fetched);
            setFabrics(data);
            setUnsavedFabrics([...data]);
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
            if (error.response && error.response.status === 404) {
                // If no fabrics exist, treat it as empty and ensure a blank row is present
                setFabrics(ensureBlankRow([]));
                setUnsavedFabrics(ensureBlankRow([]));
            } else {
                setError("Failed to load fabrics.");
                setFabrics(ensureBlankRow([]));  // Ensure at least one blank row
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ Handle table edits & auto-add new row when needed
    const handleTableChange = (changes, source) => {
        if (!changes || source === "loadData") return;

        const updatedFabrics = [...unsavedFabrics];
        let shouldAddNewRow = false;

        changes.forEach(([visualRow, prop, oldValue, newValue]) => {
            if (oldValue !== newValue) {
                const physicalRow = tableRef.current.hotInstance.toPhysicalRow(visualRow);
                if (physicalRow === null) return;

                updatedFabrics[physicalRow][prop] = newValue;

                // ✅ If editing last row, add a new blank row
                if (physicalRow === updatedFabrics.length - 1 && newValue.trim() !== "") {
                    shouldAddNewRow = true;
                }
            }
        });

        if (shouldAddNewRow) {
            updatedFabrics.push({ id: null, name: "", san_vendor: "", zoneset_name: "", vsan: "", exists: false });
        }

        setIsDirty(true);
        setUnsavedFabrics(updatedFabrics);
    };

    // ✅ Save updated & new fabrics
    const handleSave = async () => {
        if (!config?.customer?.id) {
            setSaveStatus("⚠️ No active customer selected!");
            return;
        }
    
        setSaveStatus("Saving...");
    
        const payload = unsavedFabrics
            .filter(fabric => fabric.name.trim())  // ✅ Only send valid entries
            .map(fabric => {
                const sanVendorCode = vendorOptions.find(o => o.name === fabric.san_vendor)?.code || fabric.san_vendor;
                return {
                    ...fabric,
                    san_vendor: sanVendorCode,
                    customer: config.customer.id,  // ✅ Assign customer to new rows
                    vsan: fabric.vsan === "" ? null : fabric.vsan  // ✅ Convert empty vsan to null
                };
            });
    
        console.log("🔍 Payload being sent to API:", JSON.stringify(payload, null, 2));
    
        try {
            const response = await axios.post(
                fabricSaveApiUrl,
                { customer_id: config.customer.id, fabrics: payload }
            );
    
            console.log("✅ Save Response:", response.data);
            setSaveStatus("Fabrics saved successfully! ✅");
            setIsDirty(false);
            fetchFabrics(config.customer.id);  // ✅ Refresh table
        } catch (error) {
            console.error("❌ Error saving fabrics:", error);
        
            if (error.response) {
                console.error("❌ API Response Error:", JSON.stringify(error.response.data, null, 2));
        
                if (error.response.data.details) {
                    const errorMessages = error.response.data.details.map(e => {
                        const errorText = Object.values(e.errors).flat().join(", "); // ✅ Convert error object to string
                        return `Can't save fabric name: "${e.fabric}".  ${errorText}`;
                    });
        
                    setSaveStatus(`⚠️ Error: ${errorMessages.join(" | ")}`);
                } else {
                    setSaveStatus("⚠️ Error saving fabrics! Please try again.");
                }
            } else {
                setSaveStatus("⚠️ Network error. Try again.");
            }
        }
    };

    const handleColumnResize = (currentColumn, newSize, isDoubleClick) => {
        const totalCols = tableRef.current.hotInstance.countCols();
        const widths = [];
        for (let i = 0; i < totalCols; i++) {
            widths.push(tableRef.current.hotInstance.getColWidth(i));
        }
        localStorage.setItem("fabricTableColumnWidths", JSON.stringify(widths));
    };
    const handleRemoveRows = (index, amount, physicalRows, source) => {
            // For each row that is about to be removed, check if it has an ID.
            physicalRows.forEach(rowIndex => {
                const fabricToDelete = unsavedFabrics[rowIndex];
                if (fabricToDelete && fabricToDelete.id) {
                    // Call your backend delete endpoint.
                    axios.delete(`${fabricDeleteApiUrl}${fabricToDelete.id}/`)
                        .then(response => {
                            console.log("Deleted fabric", fabricToDelete.id);
                        })
                        .catch(error => {
                            console.error("Error deleting fabric", fabricToDelete.id, error);
                        });
                }
            });
        };

    const handleNavigationAttempt = (path) => {
        if (isDirty) {
            setNextPath(path);
            setShowNavigationModal(true);
        } else {
            navigate(path);
        }
    };

    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const originalPushState = window.history.pushState;
        window.history.pushState = function(state, title, url) {
            setNextPath(url);
            setShowNavigationModal(true);
            // Do not call originalPushState to block navigation
        };
        return () => {
            window.history.pushState = originalPushState;
        };
    }, [isDirty]);

    useEffect(() => {
        if (!isDirty) return;
        const handlePopState = (e) => {
            e.preventDefault();
            window.history.pushState(null, "", window.location.pathname);
            setNextPath(window.location.pathname);
            setShowNavigationModal(true);
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isDirty]);

    return (
        <div className="table-container">

            {configLoading ? (
                <Alert variant="info">Loading configuration...</Alert>
            ) : loading ? (
                <Alert variant="info">Loading fabrics...</Alert>
            ) : error ? (
                <Alert variant="danger">{error}</Alert>
            ) : (
                <> 
                    <div>
                        <Button className="save-button" onClick={handleSave}>Save</Button>
                    </div>
                    <HotTable
                        ref={tableRef}
                        data={unsavedFabrics}
                        fixedColumnsLeft={2}
                        colHeaders={["ID", "Name", "Vendor", "Zoneset Name", "VSAN", "Exists", "Notes"]}
                        columns={[
                            { data: "id", readOnly: true, className: "htCenter" },
                            { data: "name" },
                            { data: "san_vendor", type: "dropdown", source: vendorOptions.map(o => o.name), strict: true },
                            { data: "zoneset_name" },
                            { data: "vsan", type: "numeric", className: "htCenter" },
                            { data: "exists", type: "checkbox", className: "htCenter" },
                            { data: "notes" },
                        ]}
                        contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo']}
                        beforeRemoveRow={handleRemoveRows}
                        manualColumnResize={true}
                        autoColumnSize={true}
                        afterColumnResize={handleColumnResize}
                        colWidths={(() => {
                            const stored = localStorage.getItem("fabricTableColumnWidths");
                            if (stored) {
                                try {
                                    return JSON.parse(stored);
                                } catch (e) {
                                    return 200;
                                }
                            }
                            return 200;
                        })()}
                        columnSorting={true}
                        afterChange={handleTableChange}
                        licenseKey="non-commercial-and-evaluation"
                        className="htMaterial"
                        dropdownMenu={true}
                        stretchH="all"
                        filters={true}
                        rowHeaders={false}
                        height="calc(100vh - 200px)"
                        dragToScroll={true}
                        width="100%"
                        />
                    {saveStatus && (
                        <Alert variant={saveStatus.includes("Error") ? "danger" : "success"} className="mt-2">
                            {saveStatus}
                        </Alert>
                    )}
                </>
            )}
            <Modal show={showNavigationModal} onHide={() => setShowNavigationModal(false)}>
              <Modal.Header closeButton>
                <Modal.Title>Unsaved Changes</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                You have unsaved changes. Are you sure you want to leave?
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowNavigationModal(false)}>
                  Stay on this page
                </Button>
                <Button variant="primary" onClick={() => {
                  setIsDirty(false);
                  setShowNavigationModal(false);
                  navigate(nextPath);
                }}>
                  Leave
                </Button>
              </Modal.Footer>
            </Modal>
        </div>
    );
};

export default FabricTable;