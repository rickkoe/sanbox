import React from 'react';
import { Link } from 'react-router-dom';
import './EmptyConfigMessage.css';

const EmptyConfigMessage = ({ entityName = "data" }) => {
    return (
        <div className="modern-table-container">
            <div className="empty-config-alert" role="alert">
                <div className="empty-config-heading">
                    <span className="empty-config-icon">⚙️</span>
                    <h4 className="mb-0">Setup Required</h4>
                </div>
                <p>To view and manage {entityName}, you need to set up your configuration first.</p>
                <hr />
                <ol className="mb-0">
                    <li>Go to <Link to="/settings/project-config"><strong>Settings → Project Configuration</strong></Link></li>
                    <li>Create a new customer or select an existing one</li>
                    <li>Create a new project or select an existing one</li>
                    <li>Save your configuration</li>
                </ol>
                <div className="mt-3">
                    <Link to="/settings/project-config" className="btn btn-primary btn-lg">
                        Go to Configuration
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default EmptyConfigMessage;
