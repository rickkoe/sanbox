import axios from "axios";

// Smart detection function for WWPN type
export const detectWwpnType = async (wwpn) => {
  try {
    const response = await axios.post('/api/san/wwpn-prefixes/detect-type/', {
      wwpn: wwpn
    });
    return response.data.detected_type || null;
  } catch (error) {
    console.warn(`Failed to detect WWPN type for ${wwpn}:`, error);
    return null;
  }
};