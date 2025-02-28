import React, { useEffect, useState } from 'react';
import axios from 'axios';

const CustomerTable = () => {
    const [customers, setCustomers] = useState([]);

    useEffect(() => {
        axios.get('http://127.0.0.1:8000/api/customers/')
            .then(response => {
                setCustomers(response.data);
            })
            .catch(error => console.error("Error fetching customers:", error));
    }, []);

    return (
        <div>
            <h2>Customers</h2>
            <table border="1">
                <thead>
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
    );
};

export default CustomerTable;