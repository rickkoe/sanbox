import React, { useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "./context/ConfigContext";
import { useSettings } from "./context/SettingsContext";
import { useNavigate } from "react-router-dom";
import GenericTableFast from "./components/tables/GenericTable/GenericTableFast";
import CustomNamingApplier from "./components/naming/CustomNamingApplier";
import { getTextColumns } from "./utils/tableNamingUtils";

// API endpoints
const API_URL = process.env.REACT_APP_API_URL || "";
const API_ENDPOINTS = {
  zones: `${API_URL}/api/san/zones/project/`,
  fabrics: `${API_URL}/api/san/fabrics/`,
  aliases: `${API_URL}/api/san/aliases/project/`,
  zoneSave: `${API_URL}/api/san/zones/save/`,
  zoneDelete: `${API_URL}/api/san/zones/delete/`,
};

// Template for new rows
const NEW_ZONE_TEMPLATE = {
  id: null,
  zone_status: "valid",
  name: "",
  fabric: "",
  member_count: 0,
  create: false,
  delete: false,
  exists: false,
  zone_type: "",
  notes: "",
  imported: null,
  updated: null,
  saved: false,
};

const MinimalZoneTableFast = () => {
  const { config } = useContext(ConfigContext);
  const { settings } = useSettings();
  const navigate = useNavigate();
  const tableRef = useRef(null);
  
  // State for dropdown sources
  const [fabricOptions, setFabricOptions] = useState([]);
  const [memberOptions, setMemberOptions] = useState([]);
  const [memberCount, setMemberCount] = useState(20);
  const [selectedRows, setSelectedRows] = useState([]);

  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Minimal ZoneTableFast</h1>
      <p>Project: {config?.active_project?.name || 'None'}</p>
      <p>Customer: {config?.customer?.name || 'None'}</p>
      <p>Theme: {settings.theme}</p>
      <p>Member Count: {memberCount}</p>
    </div>
  );
};

export default MinimalZoneTableFast;