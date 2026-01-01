import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import HostClusterTableTanStackClean from "../components/tables/HostClusterTableTanStackClean";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";

/**
 * StorageHostClustersPage - Displays host clusters for a specific storage system
 *
 * This page wraps the HostClusterTableTanStackClean component with a storage filter.
 *
 * URL: /storage/:id/host-clusters
 */
const StorageHostClustersPage = () => {
  const { id } = useParams();
  const API_URL = process.env.REACT_APP_API_URL || '';
  const { config } = useContext(ConfigContext);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setBreadcrumbMap, setStorageTypeMap } = useContext(BreadcrumbContext);

  const activeCustomerId = config?.customer?.id;

  useEffect(() => {
    const fetchStorage = async () => {
      if (!activeCustomerId) return;

      try {
        const response = await axios.get(`${API_URL}/api/storage/${id}/`);
        setStorage(response.data);
        setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
        setStorageTypeMap(prev => ({ ...prev, [id]: response.data.storage_type }));
      } catch (error) {
        console.error("Failed to fetch storage system:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [id, activeCustomerId, API_URL, setBreadcrumbMap, setStorageTypeMap]);

  if (loading) {
    return <div className="container mt-4">Loading storage system...</div>;
  }

  if (!storage) {
    return <div className="container mt-4">Storage system not found.</div>;
  }

  return (
    <>
      <HostClusterTableTanStackClean
        storageId={parseInt(id)}
        hideColumns={['storage_name']}
      />
    </>
  );
};

export default StorageHostClustersPage;
