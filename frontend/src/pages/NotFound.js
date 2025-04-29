import React from "react";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <div className="container text-center mt-4">
        <div className="display-1 fw-bold">404</div>
        <h1 className="display-4">No Page for You!</h1>
        <p className="lead">Come back, one year!</p>
        <motion.img
        src='/images/no-page-for-you.png'
        alt="No Page for You"
        className="img-fluid mt-4"
        style={{ maxWidth: "400px" }} // ✅ Limit image size explicitly
        animate={{ rotate: [0, -2, 2, -2, 2, 0] }} // Shaking animation
        transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2 }}
      />
    </div>
  );
};

export default NotFound;