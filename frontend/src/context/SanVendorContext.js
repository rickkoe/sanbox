import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const SanVendorContext = createContext();

export const useSanVendor = () => useContext(SanVendorContext);

export const SanVendorProvider = ({ children }) => {
    const [sanVendor, setSanVendor] = useState(null);
    const apiUrl = "http://127.0.0.1:8000/api/core/config/";

    // Fetch SAN Vendor once and store it
    useEffect(() => {
        axios.get(apiUrl)
            .then(response => {
                setSanVendor(response.data.san_vendor);
            })
            .catch(error => console.error("Error fetching SAN vendor:", error));
    }, []);

    // Function to update SAN Vendor
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