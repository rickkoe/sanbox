import React, { useEffect, useState, useContext } from "react";
import { useParams } from "react-router-dom";
import HostTable from "../components/tables/HostTable";
import Breadcrumbs from "../components/navigation/Breadcrumbs";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";

const StorageHostsPage = () => {
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
  }, [id]);

  if (loading) {
    return <p>Loading hosts for storage system...</p>;
  }

  if (!storage) {
    return <p>Storage system not found.</p>;
  }

  return (
    <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
      <h3>{storage.name} – Hosts</h3>
      <HostTable storage={storage} />
    </div>
  );
};

export default StorageHostsPage;