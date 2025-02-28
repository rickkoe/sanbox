import React, { useEffect, useState } from "react";
import axios from "axios";

const CustomerTable = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        axios.get("http://127.0.0.1:8000/api/customers/")
            .then(response => {
                setCustomers(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching customers:", error);
                setError("Failed to load customers.");
                setLoading(false);
            });
    }, []);

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Customers</h2>

            {/* Loading State */}
            {loading && <div className="alert alert-info">Loading customers...</div>}

            {/* Error Message */}
            {error && <div className="alert alert-danger">{error}</div>}

            {/* Customer Table */}
            {!loading && !error && (
                <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                        <thead className="table-dark">
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(customer => (
                                <tr key={customer.id}>
                                    <td>{customer.id}</td>
                                    <td>{customer.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CustomerTable;