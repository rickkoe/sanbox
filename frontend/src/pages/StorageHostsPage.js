import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import HostTableTanStackClean from "../components/tables/HostTableTanStackClean";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";

/**
 * StorageHostsPage - Displays hosts for a specific storage system
 *
 * This page simply wraps the HostTableTanStackClean component with a storage filter.
 * All host management logic is centralized in HostTableTanStackClean.
 *
 * URL: /storage/:id/hosts
 */
const StorageHostsPage = () => {
  const { id } = useParams(); // Storage system ID from URL
  const API_URL = process.env.REACT_APP_API_URL || '';
  const { config } = useContext(ConfigContext);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);

  const activeCustomerId = config?.customer?.id;

  useEffect(() => {
    const fetchStorage = async () => {
      if (!activeCustomerId) return;

      try {
        const response = await axios.get(`${API_URL}/api/storage/${id}/`);
        setStorage(response.data);
        // Update breadcrumb with storage system name
        setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
      } catch (error) {
        console.error("Failed to fetch storage system:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [id, activeCustomerId, API_URL, setBreadcrumbMap]);

  if (loading) {
    return <div className="container mt-4">Loading storage system...</div>;
  }

  if (!storage) {
    return <div className="container mt-4">Storage system not found.</div>;
  }

  return (
    <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
      {/* Use the centralized HostTableTanStackClean component with storage filter */}
      {/* Hide the Storage System column since we're already filtering by storage */}
      <HostTableTanStackClean
        storageId={parseInt(id)}
        hideColumns={['storage_system']}
      />
    </div>
  );
};

export default StorageHostsPage;
