import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ConfigContext } from "../context/ConfigContext";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import PortTableTanStackClean from "../components/tables/PortTableTanStackClean";

/**
 * StoragePortsPage - Displays ports for a specific storage system
 *
 * This page simply wraps the PortTableTanStackClean component with a storage filter.
 * All port management logic is centralized in PortTableTanStackClean.
 *
 * URL: /storage/:id/ports
 */
const StoragePortsPage = () => {
    const { id } = useParams(); // Storage system ID from URL
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config } = useContext(ConfigContext);
    const { setBreadcrumbMap } = useContext(BreadcrumbContext);

    const [storageSystem, setStorageSystem] = useState(null);
    const [loading, setLoading] = useState(true);

    const activeCustomerId = config?.customer?.id;

    // Fetch storage system details for breadcrumb
    useEffect(() => {
        const fetchStorage = async () => {
            if (!activeCustomerId) return;

            try {
                const response = await axios.get(`${API_URL}/api/storage/${id}/`);
                setStorageSystem(response.data);
                // Update breadcrumb with storage system name
                setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
                setLoading(false);
            } catch (error) {
                console.error("Failed to fetch storage system:", error);
                setLoading(false);
            }
        };
        fetchStorage();
    }, [id, activeCustomerId, API_URL, setBreadcrumbMap]);

    if (loading) {
        return <div className="container mt-4">Loading storage system...</div>;
    }

    if (!storageSystem) {
        return <div className="container mt-4">Storage system not found.</div>;
    }

    return (
        <>
            {/* Use the centralized PortTableTanStackClean component with storage filter */}
            {/* Hide the Storage System column since we're already filtering by storage */}
            <PortTableTanStackClean
                storageId={parseInt(id)}
                hideColumns={['storage']}
            />
        </>
    );
};

export default StoragePortsPage;
