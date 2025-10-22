import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import Breadcrumbs from "../components/navigation/Breadcrumbs";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";
import VolumeTableTanStackClean from "../components/tables/VolumeTableTanStackClean";

const StorageVolumesPage = () => {
  const { id } = useParams();
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const response = await axios.get(`/api/storage/${id}/`);
        setStorage(response.data);
        setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
      } catch (error) {
        console.error("Failed to fetch storage system:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [id, setBreadcrumbMap]);

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

  if (!storage) {
    return (
      <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
        <div className="alert alert-warning">Storage system not found.</div>
      </div>
    );
  }

  return (
    <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
      <VolumeTableTanStackClean
        storageId={parseInt(id)}
        hideColumns={['storage']}
      />
    </div>
  );
};

export default StorageVolumesPage;