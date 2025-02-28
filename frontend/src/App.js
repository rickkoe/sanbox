import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import CustomerTable from './components/CustomerTable';

function Home() {
    return <h1>Welcome to SANBox!</h1>;
}

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/customers" element={<CustomerTable />} />
            </Routes>
        </Router>
    );
}

export default App;