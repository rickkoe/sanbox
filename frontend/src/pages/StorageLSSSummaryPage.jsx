import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";
import LSSSummaryTableTanStackClean from "../components/tables/LSSSummaryTableTanStackClean";

/**
 * StorageLSSSummaryPage - Displays LSS Summary for a DS8000 storage system
 *
 * LSS (Logical Subsystem) data is computed from volumes.
 * Only available for DS8000 storage systems.
 *
 * URL: /storage/:id/lss-summary
 */
const StorageLSSSummaryPage = () => {
  const { id } = useParams();
  const API_URL = process.env.REACT_APP_API_URL || '';
  const { setBreadcrumbMap, setStorageTypeMap } = useContext(BreadcrumbContext);
  const { config } = useContext(ConfigContext);

  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeCustomerId = config?.customer?.id;

  useEffect(() => {
    const fetchStorage = async () => {
      if (!activeCustomerId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(`${API_URL}/api/storage/${id}/`);
        setStorage(response.data);
        setBreadcrumbMap((prev) => ({ ...prev, [id]: response.data.name }));
        setStorageTypeMap((prev) => ({ ...prev, [id]: response.data.storage_type }));

        // Verify it's DS8000
        if (response.data.storage_type !== "DS8000") {
          setError(
            `LSS Summary is only available for DS8000 storage systems. This storage is type: ${response.data.storage_type}`
          );
        }
      } catch (err) {
        console.error("Failed to load storage details:", err);
        setError(err.response?.data?.error || "Failed to load storage details");
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [id, activeCustomerId, API_URL, setBreadcrumbMap, setStorageTypeMap]);

  if (loading) {
    return <div className="container mt-4">Loading storage system...</div>;
  }

  if (error) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">{error}</div>
      </div>
    );
  }

  if (!storage) {
    return <div className="container mt-4">Storage system not found.</div>;
  }

  return (
    <LSSSummaryTableTanStackClean storageId={parseInt(id)} />
  );
};

export default StorageLSSSummaryPage;
