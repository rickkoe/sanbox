import React from "react";
import { FaDatabase, FaCloud, FaDownload } from "react-icons/fa";

const InsightsPage = () => {
  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">Storage Insights</h1>
      
      <div className="row justify-content-center">
        {/* Data Importer Card */}
        <div className="col-md-6 mb-4">
          <a href="/insights/importer" className="home-card card text-center h-100">
            <div className="card-body">
              <FaDatabase size={48} className="home-icon mb-3" />
              <h5 className="card-title">Data Importer</h5>
              <p className="card-text">Import storage system data from IBM Storage Insights.</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
};

export default InsightsPage;