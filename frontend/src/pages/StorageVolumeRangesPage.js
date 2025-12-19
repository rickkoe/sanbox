import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import { ConfigContext } from "../context/ConfigContext";
import VolumeRangeTableTanStackClean from "../components/tables/VolumeRangeTableTanStackClean";
import "../styles/volume-ranges.css";

const StorageVolumeRangesPage = () => {
  const { id } = useParams();
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);
  const { config } = useContext(ConfigContext);

  // Data state
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch storage details
  const fetchStorageDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch storage details
      const storageRes = await axios.get(`/api/storage/${id}/`);
      setStorage(storageRes.data);
      setBreadcrumbMap((prev) => ({ ...prev, [id]: storageRes.data.name }));

      // Verify it's DS8000
      if (storageRes.data.storage_type !== "DS8000") {
        setError(
          `Volume ranges are only available for DS8000 storage systems. This storage is type: ${storageRes.data.storage_type}`
        );
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err) {
      console.error("Failed to load storage details:", err);
      setError(err.response?.data?.error || "Failed to load storage details");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStorageDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
        <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <span className="ms-2">Loading storage system...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
        <div className="alert alert-warning m-4">{error}</div>
      </div>
    );
  }

  if (!storage) {
    return (
      <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
        <div className="alert alert-warning m-4">Storage system not found.</div>
      </div>
    );
  }

  return (
    <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
      <VolumeRangeTableTanStackClean
        storageId={parseInt(id)}
        storageName={storage?.name}
        onRangeCreated={fetchStorageDetails}
      />
    </div>
  );
};

export default StorageVolumeRangesPage;
