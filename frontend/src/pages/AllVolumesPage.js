import React from "react";
import VolumeTableTanStackClean from "../components/tables/VolumeTableTanStackClean";

/**
 * AllVolumesPage - Display all volumes across all storage systems
 *
 * This page shows volumes from all storage systems that the user has access to.
 * Unlike StorageVolumesPage which filters by a specific storage system,
 * this page shows everything.
 */
const AllVolumesPage = () => {
  return (
    <div className="main-content table-page" style={{ paddingBottom: "50px" }}>
      <VolumeTableTanStackClean />
    </div>
  );
};

export default AllVolumesPage;
