import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const useDashboardData = (config, autoRefreshInterval = 30000) => {
  const [data, setData] = useState({
    stats: {
      stats: {},
      customer: {},
      last_import: null
    },
    capacity: {
      storage_systems: [],
      capacity_by_type: {},
      total_capacity_tb: 0,
      utilization_percent: 0,
      alerts: []
    },
    health: {
      overall_status: 'unknown',
      issues: [],
      fabric_status: [],
      storage_status: [],
      connection_tests: {}
    },
    activity: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!config?.customer?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = { 
        customer_id: config.customer.id,
        project_id: config.active_project?.id,
        _t: forceRefresh ? Date.now() : undefined
      };
      
      // Fetch all dashboard data in parallel
      const [statsRes, capacityRes, healthRes, activityRes] = await Promise.all([
        axios.get('/api/core/dashboard/stats/', { params }),
        axios.get('/api/core/dashboard/capacity/', { params: { customer_id: config.customer.id } }),
        axios.get('/api/core/dashboard/health/', { params: { customer_id: config.customer.id } }),
        axios.get('/api/core/dashboard/activity/', { params: { customer_id: config.customer.id, limit: 5 } })
      ]);
      
      setData({
        stats: statsRes.data,
        capacity: capacityRes.data,
        health: healthRes.data,
        activity: activityRes.data
      });
      setLastUpdated(new Date());
      
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(`Failed to fetch dashboard data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [config?.customer?.id, config?.active_project?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefreshInterval || !config?.customer?.id) return;

    const interval = setInterval(() => {
      // Only auto-refresh if page is visible
      if (!document.hidden) {
        fetchData(false); // Silent refresh without showing loading
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [fetchData, autoRefreshInterval, config?.customer?.id]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh
  };
};