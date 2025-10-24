import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/api/auth/user/');
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      // User is not authenticated
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/auth/login/', {
        username,
        password,
      });

      setUser(response.data.user);
      setIsAuthenticated(true);

      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout/');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register/', userData);

      setUser(response.data.user);
      setIsAuthenticated(true);

      return { success: true, user: response.data.user };
    } catch (error) {
      const errorMessage = error.response?.data || 'Registration failed';
      return { success: false, error: errorMessage };
    }
  };

  //Helper to get user's role for a specific customer
  // SIMPLIFIED: All authenticated users are now admins (no CustomerMembership model)
  const getUserRole = (customerId) => {
    if (!user) {
      return null;
    }
    // All authenticated users have full access
    return 'admin';
  };

  // Helper to check if user is admin for a customer
  // SIMPLIFIED: All authenticated users are admins
  const isCustomerAdmin = (customerId) => {
    return user !== null;
  };

  // Helper to check if user is at least a member
  // SIMPLIFIED: All authenticated users are members
  const isCustomerMember = (customerId) => {
    return user !== null;
  };

  // Helper to check if user can view customer
  // SIMPLIFIED: All authenticated users can view all customers
  const canViewCustomer = (customerId) => {
    return user !== null;
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    register,
    checkAuth,
    getUserRole,
    isCustomerAdmin,
    isCustomerMember,
    canViewCustomer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
