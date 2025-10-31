import axios from "axios";

const api = axios.create({
  baseURL: "/", // Use root since all URLs already include /api/
  timeout: 30000, // 30 second timeout for large dataset operations
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable sending cookies for session authentication
});

// Function to get CSRF token from cookie
function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Add CSRF token to all non-GET requests
api.interceptors.request.use(
  (config) => {
    // Add CSRF token for non-safe methods
    if (['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfToken = getCookie('csrftoken');
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // NOTE: Redirect handling is now done by ProtectedRoute component
    // to avoid conflicts with React Router navigation.
    // The interceptor just passes errors through.

    // If 401 or 403, just log it - ProtectedRoute will handle the redirect
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('Authentication error:', error.response.status, 'at', error.config?.url);
      // ProtectedRoute will detect this and redirect appropriately
    }

    return Promise.reject(error);
  }
);

export default api;
