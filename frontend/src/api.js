import axios from "axios";

const api = axios.create({
  baseURL: "/api/", // Django API base URL
  timeout: 5000, // Optional: Set timeout
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;