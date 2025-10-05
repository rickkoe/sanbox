import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const { user, getUserRole, isCustomerAdmin, isCustomerMember, canViewCustomer } = useAuth();
  const [config, setConfig] = useState(null);
  const [activeStorageSystem, setActiveStorageSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeConfigApiUrl = "/api/core/active-config/";

  useEffect(() => {
    fetchActiveConfig();
  }, []);

  const fetchActiveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(activeConfigApiUrl);

      if (Object.keys(response.data).length > 0) {
        setConfig(response.data);
      } else {
        setConfig(null);  // ✅ No active config found
      }
    } catch (err) {
      console.error("❌ Error fetching active config:", err);
      setError("Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  // Permission helper functions based on active config's customer
  const getActiveCustomerId = () => {
    return config?.customer?.id;
  };

  const getActiveCustomerRole = () => {
    const customerId = getActiveCustomerId();
    return customerId ? getUserRole(customerId) : null;
  };

  const canEditInfrastructure = () => {
    const customerId = getActiveCustomerId();
    return customerId ? isCustomerAdmin(customerId) : false;
  };

  const canCreateProjects = () => {
    const customerId = getActiveCustomerId();
    return customerId ? isCustomerMember(customerId) : false;
  };

  const canViewActiveCustomer = () => {
    const customerId = getActiveCustomerId();
    return customerId ? canViewCustomer(customerId) : false;
  };

  const hasPermission = (minRole = 'viewer') => {
    if (!user) return false;
    if (user.is_superuser) return true;

    const customerId = getActiveCustomerId();
    if (!customerId) return false;

    const currentRole = getUserRole(customerId);
    if (!currentRole) return false;

    const roleHierarchy = { viewer: 0, member: 1, admin: 2 };
    const currentLevel = roleHierarchy[currentRole] || -1;
    const requiredLevel = roleHierarchy[minRole] || 0;

    return currentLevel >= requiredLevel;
  };

  return (
    <ConfigContext.Provider value={{
      config,
      loading,
      error,
      refreshConfig: fetchActiveConfig,
      activeStorageSystem,
      setActiveStorageSystem,
      // Permission helpers
      getActiveCustomerId,
      getActiveCustomerRole,
      canEditInfrastructure,
      canCreateProjects,
      canViewActiveCustomer,
      hasPermission
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

// Custom hook for using config context
export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};