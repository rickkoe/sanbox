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
    // If 401 or 403, redirect to login page (unless already on login page)
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !window.location.pathname.includes('/login')
    ) {
      // Store the current path to redirect back after login
      localStorage.setItem('redirectAfterLogin', window.location.pathname);

      // Redirect to login
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
