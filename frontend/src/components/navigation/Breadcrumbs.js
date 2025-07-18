import React, { useContext } from "react";
import { BreadcrumbContext } from "../../context/BreadcrumbContext";
import { Link, useLocation } from "react-router-dom";
import { Breadcrumb } from "react-bootstrap";

const Breadcrumbs = () => {
    const { breadcrumbMap } = useContext(BreadcrumbContext);
    const location = useLocation();
    const paths = location.pathname.split("/").filter(path => path);

    return (
        <div className="breadcrumb-container">
            <nav className="breadcrumb-nav">
                <ol className="breadcrumb modern-breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/" className="breadcrumb-link home-link">
                            <span className="breadcrumb-icon">🏠</span>
                            <span className="breadcrumb-text">Home</span>
                        </Link>
                    </li>
                    {paths.map((path, index) => {
                        const routeTo = "/" + paths.slice(0, index + 1).join("/");
                        const isLast = index === paths.length - 1;
                        const displayName =
                            breadcrumbMap[path] && isNaN(path)
                                ? breadcrumbMap[path]
                                : !isNaN(path) && breadcrumbMap[path]
                                ? breadcrumbMap[path]
                                : path.toLowerCase() === "san"
                                ? "SAN"
                                : path.charAt(0).toUpperCase() + path.slice(1);

                        return (
                            <li key={index} className={`breadcrumb-item ${isLast ? 'active' : ''}`}>
                                <span className="breadcrumb-separator">›</span>
                                {isLast ? (
                                    <span className="breadcrumb-current">
                                        {displayName}
                                    </span>
                                ) : (
                                    <Link to={routeTo} className="breadcrumb-link">
                                        {displayName}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </nav>
        </div>
    );
};

export default Breadcrumbs;