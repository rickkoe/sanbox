import React from 'react';
import { Link } from 'react-router-dom';

const EmptyConfigMessage = ({ entityName = "data" }) => {
    return (
        <div className="modern-table-container">
            <div className="alert alert-warning" role="alert">
                <h4 className="alert-heading">Setup Required</h4>
                <p>To view and manage {entityName}, you need to set up your configuration first.</p>
                <hr />
                <ol className="mb-0">
                    <li>Go to <Link to="/settings/project-config"><strong>Settings → Project Configuration</strong></Link></li>
                    <li>Create a new customer or select an existing one</li>
                    <li>Create a new project or select an existing one</li>
                    <li>Save your configuration</li>
                </ol>
                <div className="mt-3">
                    <Link to="/settings/project-config" className="btn btn-primary">
                        Go to Configuration
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default EmptyConfigMessage;
