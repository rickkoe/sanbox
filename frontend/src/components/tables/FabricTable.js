import React, { useEffect, useState, useRef, useContext } from "react";
import axios from "axios";
import { HotTable } from "@handsontable/react";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import { ConfigContext } from "../../context/ConfigContext";  // ✅ Import ConfigContext

// Register all Handsontable modules
registerAllModules();

const FabricTable = () => {
    const { config, loading: configLoading } = useContext(ConfigContext);  // ✅ Get active config
    const [fabrics, setFabrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const tableRef = useRef(null);

    useEffect(() => {
        if (config?.customer?.id) {  // ✅ Fetch fabrics only when a customer is available
            fetchFabrics(config.customer.id);
        }
    }, [config]);  // ✅ Refetch fabrics when active config changes

    const fetchFabrics = async (customerId) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`http://127.0.0.1:8000/api/san/fabrics/customer/${customerId}/`);
            setFabrics(response.data);
        } catch (error) {
            console.error("❌ Error fetching fabrics:", error);
            setError("Failed to load fabrics.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-4">
            <h2>Fabrics for {config?.customer?.name || "Customer"}</h2>

            {configLoading ? (
                <div className="alert alert-info">Loading configuration...</div>
            ) : loading ? (
                <div className="alert alert-info">Loading fabrics...</div>
            ) : error ? (
                <div className="alert alert-danger">{error}</div>
            ) : (
                <HotTable
                    ref={tableRef}
                    data={fabrics}
                    colHeaders={["ID", "Name", "Zoneset Name", "VSAN", "Exists"]}
                    columns={[
                        { data: "id", readOnly: true },
                        { data: "name" },
                        { data: "zoneset_name" },
                        { data: "vsan", type: "numeric" },
                        { data: "exists", type: "checkbox" },
                    ]}
                    licenseKey="non-commercial-and-evaluation"
                    className="handsontable"
                    dropdownMenu={true}
                    filters={true}
                    rowHeaders={false}
                />
            )}
        </div>
    );
};

export default FabricTable;