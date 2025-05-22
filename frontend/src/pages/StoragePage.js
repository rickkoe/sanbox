import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { BreadcrumbContext } from "../context/BreadcrumbContext";

const StoragePage = () => {
  const { id } = useParams();
  const [storage, setStorage] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const { setBreadcrumbMap } = useContext(BreadcrumbContext);

  useEffect(() => {
    const fetchStorage = async () => {
      try {
        const response = await axios.get(`/api/storage/${id}/`);
        setStorage(response.data);
        setFormData(response.data);
        setBreadcrumbMap(prev => ({ ...prev, [id]: response.data.name }));
      } catch (error) {
        console.error("Failed to fetch storage system:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStorage();
  }, [id, setBreadcrumbMap]);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await axios.patch(`/api/storage/${id}/`, formData);
      alert("Changes saved successfully.");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes.");
    }
  };

  if (loading) return <p>Loading storage system details...</p>;
  if (!storage) return <p>Storage system not found.</p>;

  return (
    <div className="container">
      <h3>{storage.name} Properties</h3>
      <form className="card p-4">
        <div className="mb-3">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
        {Object.entries(storage).map(([key, value]) => {
          const displayValue =
            formData[key] !== null && formData[key] !== undefined
              ? formData[key]
              : "";

          const isBoolean = typeof value === "boolean";
          const isReadOnly = key === "id";

          return (
            <div key={key} className="mb-3">
              <label className="form-label fw-bold text-capitalize text-break">
                {key.replace(/_/g, " ")}
              </label>
              {isBoolean ? (
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={!!formData[key]}
                    onChange={(e) => handleChange(key, e.target.checked)}
                    disabled={isReadOnly}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  className="form-control"
                  value={displayValue}
                  onChange={(e) => handleChange(key, e.target.value)}
                  readOnly={isReadOnly}
                />
              )}
            </div>
          );
        })}
        <div className="mb-3">
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default StoragePage;