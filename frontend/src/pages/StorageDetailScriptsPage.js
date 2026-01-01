import { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";
import StorageScriptsContent from "../components/storage/StorageScriptsContent";

/**
 * StorageDetailScriptsPage - Displays scripts for a specific storage system
 *
 * This page wraps the StorageScriptsContent component with a storage filter.
 * It shows only scripts for the currently viewed storage system.
 *
 * URL: /storage/:id/scripts
 */
const StorageDetailScriptsPage = () => {
  const { id } = useParams(); // Storage system ID from URL
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
        // Update breadcrumb with storage system name
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
    <StorageScriptsContent
      storageId={parseInt(id)}
      storageName={storage.name}
      hideStorageSelector={true}
      backPath={`/storage/${id}`}
    />
  );
};

export default StorageDetailScriptsPage;
