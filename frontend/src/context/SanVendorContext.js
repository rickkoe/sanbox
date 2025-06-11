import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

const SanVendorContext = createContext();
const configApiUrl = "/api/core/config/";

export const useSanVendor = () => useContext(SanVendorContext);

export const SanVendorProvider = ({ children }) => {
    const [sanVendor, setSanVendor] = useState(null);
    const apiUrl = configApiUrl;
    const location = useLocation(); // ✅ Get the current route

    // ✅ Fetch SAN Vendor whenever the app loads OR when a SAN page is visited
    useEffect(() => {
        if (location.pathname.startsWith("/san/")) {
            axios.get(apiUrl)
                .then(response => {
                    setSanVendor(response.data.san_vendor);
                })
                .catch(error => console.error("Error fetching SAN vendor:", error));
        }
    }, [location.pathname]);  // ✅ Re-fetch when navigating

    // ✅ Function to update SAN Vendor
    const updateSanVendor = (newSanVendor) => {
        axios.get(apiUrl)
            .then(response => {
                const updatedConfig = { ...response.data, san_vendor: newSanVendor };
                setSanVendor(newSanVendor);

                // ✅ Save to Django
                return axios.put(apiUrl, updatedConfig);
            })
            .catch(error => console.error("Error updating SAN vendor:", error));
    };

    return (
        <SanVendorContext.Provider value={{ sanVendor, updateSanVendor }}>
            {children}
        </SanVendorContext.Provider>
    );
};