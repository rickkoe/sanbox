import React, { createContext, useState, useEffect, useContext } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";

export const ConfigContext = createContext();

export const ConfigProvider = ({ children }) => {
  const { user, getUserRole, isCustomerAdmin, isCustomerMember, canViewCustomer, checkAuth } = useAuth();
  const [config, setConfig] = useState(null);
  const [activeStorageSystem, setActiveStorageSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userConfigApiUrl = "/api/core/user-config/";

  // Callback for refreshing projects list (registered by DualContextDropdown)
  const refreshProjectsListCallback = React.useRef(null);

  useEffect(() => {
    if (user) {
      fetchActiveConfig();
    } else {
      setConfig(null);
      setLoading(false);
    }
  }, [user]);

  const fetchActiveConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(userConfigApiUrl);

      // New user-config endpoint returns user's active customer and project
      if (response.data && response.data.active_customer) {
        // Convert user-config format to old config format for compatibility
        const customerConfig = {
          id: response.data.id,
          customer: response.data.active_customer,
          active_project: response.data.active_project,
          is_active: true // For compatibility
        };
        setConfig(customerConfig);
      } else {
        setConfig(null);  // ✅ User has no active config (new user)
      }
    } catch (err) {
      console.error("❌ Error fetching user config:", err);
      if (err.response?.status === 401) {
        // Not authenticated
        setConfig(null);
      } else {
        setError("Failed to load configuration");
      }
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

  const updateUserConfig = async (customerId, projectId) => {
    try {
      const response = await axios.put(userConfigApiUrl, {
        active_customer_id: customerId,
        active_project_id: projectId
      });

      // Update local state
      if (response.data && response.data.active_customer) {
        const customerConfig = {
          id: response.data.id,
          customer: response.data.active_customer,
          active_project: response.data.active_project,
          is_active: true
        };
        setConfig(customerConfig);
      }

      // Refresh user data to get updated memberships
      await checkAuth();

      return { success: true };
    } catch (err) {
      console.error("❌ Error updating user config:", err);
      return { success: false, error: err.message };
    }
  };

  // Register callback for refreshing projects list (used by DualContextDropdown)
  const registerRefreshProjectsList = (callback) => {
    refreshProjectsListCallback.current = callback;
  };

  // Call the registered callback to refresh projects list
  const refreshProjectsList = () => {
    if (refreshProjectsListCallback.current) {
      refreshProjectsListCallback.current();
    }
  };

  return (
    <ConfigContext.Provider value={{
      config,
      loading,
      error,
      refreshConfig: fetchActiveConfig,
      updateUserConfig,
      activeStorageSystem,
      setActiveStorageSystem,
      registerRefreshProjectsList,
      refreshProjectsList,
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