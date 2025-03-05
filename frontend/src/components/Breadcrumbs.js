import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Breadcrumb, Container } from "react-bootstrap";
import "./Breadcrumbs.css"; // ✅ Import custom styles

const Breadcrumbs = () => {
    const location = useLocation();

    // ✅ Convert the pathname into breadcrumb items
    const paths = location.pathname.split("/").filter(path => path);

    return (
        <Container>
            <div className="breadcrumb-container">
                <Breadcrumb>
                    <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                        Home
                    </Breadcrumb.Item>
                    {paths.map((path, index) => {
                        const routeTo = "/" + paths.slice(0, index + 1).join("/");
                        return (
                            <Breadcrumb.Item key={index} linkAs={Link} linkProps={{ to: routeTo }} active={index === paths.length - 1}>
                                {path.toLowerCase() === "san" ? "SAN" : path.charAt(0).toUpperCase() + path.slice(1)}
                            </Breadcrumb.Item>
                        );
                    })}
                </Breadcrumb>
            </div>
        </Container>
    );
};

export default Breadcrumbs;