import React, { useEffect, useRef, useState, useContext } from "react";
import GenericTable from "./GenericTable";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const vendorOptions = [
  { code: 'CI', name: 'Cisco' },
  { code: 'BR', name: 'Brocade' }
];

const FabricTable = () => {
    const { config, loading: configLoading } = useContext(ConfigContext);
    const [isDirty, setIsDirty] = useState(false);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [nextPath, setNextPath] = useState(null);
    const tableRef = useRef(null);
    const dropdownSources = {
      san_vendor: vendorOptions.map(o => o.name)
    };
    const navigate = useNavigate();

    const NEW_FABRIC_TEMPLATE = { id: null, name: "", san_vendor: "", zoneset_name: "", vsan: "", exists: false, notes: "" };
    const fabricsApiUrl = "http://127.0.0.1:8000/api/san/fabrics/";
    const fabricDeleteApiUrl = "http://127.0.0.1:8000/api/san/fabrics/delete/";

    const colHeaders = ["ID", "Name", "Vendor", "Zoneset Name", "VSAN", "Exists", "Notes"];
    const columns = [
        { data: "id", readOnly: true, className: "htCenter" },
        { data: "name" },
        {
            data: "san_vendor",
            type: "dropdown",
            className: "htCenter",
            renderer: (instance, td, row, col, prop, value) => {
                const displayName = vendorOptions.find(v => v.code === value || v.name === value)?.name || value;
                td.innerText = displayName;
                return td;
            }
        },
        { data: "zoneset_name" },
        { data: "vsan", type: "numeric", className: "htCenter" },
        { data: "exists", type: "checkbox", className: "htCenter" },
        { data: "notes" }
    ];

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
                    vsan: row.vsan === "" ? null : row.vsan
                };
            });

    const handleRemoveRows = (index, amount, physicalRows, source, currentData) => {
        physicalRows.forEach(rowIndex => {
            const fabric = currentData[rowIndex];
            if (fabric?.id) {
                axios.delete(`${fabricDeleteApiUrl}${fabric.id}/`)
                    .then(() => console.log("Deleted fabric", fabric.id))
                    .catch(error => console.error("Error deleting fabric", fabric.id, error));
            }
        });
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
        window.history.pushState = function (state, title, url) {
            setNextPath(url);
            setShowNavigationModal(true);
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

    const customerId = config?.customer?.id;
    const apiUrl = customerId
      ? `${fabricsApiUrl}?customer_id=${customerId}`
      : fabricsApiUrl;

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl={apiUrl}
                saveUrl={fabricsApiUrl}
                deleteUrl={fabricDeleteApiUrl}
                newRowTemplate={NEW_FABRIC_TEMPLATE}
                colHeaders={colHeaders}
                columns={columns}
                filters
                dropdownMenu
                manualColumnResize
                columnSorting
                stretchH="all"
                licenseKey="non-commercial-and-evaluation"
                storageKey="fabricTableColumnWidths"
                setIsDirty={setIsDirty}
                saveTransform={saveTransform}
                onRemoveRows={handleRemoveRows}
                dropdownSources={dropdownSources}
            />

            <Modal show={showNavigationModal} onHide={() => setShowNavigationModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Unsaved Changes</Modal.Title>
                </Modal.Header>
                <Modal.Body>You have unsaved changes. Are you sure you want to leave?</Modal.Body>
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