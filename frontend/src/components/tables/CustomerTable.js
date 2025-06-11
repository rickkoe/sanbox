import React, { useContext, useRef, useState, useEffect } from "react";
import GenericTable from "./GenericTable";
import { ConfigContext } from "../../context/ConfigContext";
import { Button, Modal } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const CustomerTable = () => {
    const { config } = useContext(ConfigContext);
    const tableRef = useRef(null);
    const navigate = useNavigate();

    const NEW_CUSTOMER_TEMPLATE = { id: null, name: "", insights_tenant: "", insights_api_key: "", notes: "" };

    const [isDirty, setIsDirty] = useState(false);
    const [showNavigationModal, setShowNavigationModal] = useState(false);
    const [nextPath, setNextPath] = useState(null);

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

    const handleNavigationAttempt = (path) => {
        if (isDirty) {
            setNextPath(path);
            setShowNavigationModal(true);
        } else {
            navigate(path);
        }
    };

    const colHeaders = ["Customer Name", "Storage Insights Tenant", "Storage Insights API Key", "Notes"];
    const columns = [
        {
            data: "name",
            renderer: (instance, td, row, col, prop, value) => {
                const customer = instance.getSourceDataAtRow(row);
                if (customer.insights_tenant) {
                    td.innerHTML = `<a href="https://insights.ibm.com/cui/${customer.insights_tenant}" target="_blank" rel="noopener noreferrer">${value}</a>`;
                } else {
                    td.innerText = value || "";
                }
                return td;
            }
        },
        { data: "insights_tenant" },
        {
            data: "insights_api_key",
            renderer: (instance, td, row, col, prop, value) => {
                const customer = instance.getSourceDataAtRow(row);
                const displayValue = customer.id && value ? "••••••••••" : "";
                td.innerText = displayValue;
                return td;
            }
        },
        { data: "notes" }
    ];

    return (
        <div className="table-container">
            <GenericTable
                ref={tableRef}
                apiUrl="/api/customers/"
                saveUrl="/api/customers/"
                deleteUrl="/api/customers/delete/"
                newRowTemplate={NEW_CUSTOMER_TEMPLATE}
                colHeaders={colHeaders}
                columns={columns}
                fixedColumnsLeft={2}
                manualColumnResize={true}
                columnSorting={true}
                filters={true}
                dropdownMenu={true}
                storageKey="customerTableColumnWidths"
                stretchH="all"
                licenseKey="non-commercial-and-evaluation"
                setIsDirty={setIsDirty}
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

export default CustomerTable;
