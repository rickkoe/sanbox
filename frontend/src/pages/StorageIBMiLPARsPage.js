import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import IBMiLPARTableTanStackClean from "../components/tables/IBMiLPARTableTanStackClean";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";

/**
 * StorageIBMiLPARsPage - Displays IBM i LPARs for a specific storage system
 *
 * This page wraps the IBMiLPARTableTanStackClean component with a storage filter.
 *
 * URL: /storage/:id/ibmi-lpars
 */
const StorageIBMiLPARsPage = () => {
  const { id } = useParams();
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
    <>
      <IBMiLPARTableTanStackClean
        storageId={parseInt(id)}
        hideColumns={['storage_name']}
      />
    </>
  );
};

export default StorageIBMiLPARsPage;
