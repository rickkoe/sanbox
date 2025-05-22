import React, { useContext } from "react";
import { BreadcrumbContext } from "../../context/BreadcrumbContext";
import { Link, useLocation } from "react-router-dom";
import { Breadcrumb } from "react-bootstrap";

const Breadcrumbs = () => {
    const { breadcrumbMap } = useContext(BreadcrumbContext);
    const location = useLocation();
    const paths = location.pathname.split("/").filter(path => path);

    return (
        <div>
            <Breadcrumb>
                <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                    Home
                </Breadcrumb.Item>
                {paths.map((path, index) => {
                    const routeTo = "/" + paths.slice(0, index + 1).join("/");
                    const displayName =
                        breadcrumbMap[path] && isNaN(path)
                            ? breadcrumbMap[path]
                            : !isNaN(path) && breadcrumbMap[path]
                            ? breadcrumbMap[path]
                            : path.toLowerCase() === "san"
                            ? "SAN"
                            : path.charAt(0).toUpperCase() + path.slice(1);

                    return (
                        <Breadcrumb.Item
                            key={index}
                            linkAs={Link}
                            linkProps={{ to: routeTo }}
                            active={index === paths.length - 1}
                        >
                            {displayName}
                        </Breadcrumb.Item>
                    );
                })}
            </Breadcrumb>
        </div>
    );
};

export default Breadcrumbs;