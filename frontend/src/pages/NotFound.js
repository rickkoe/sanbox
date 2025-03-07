import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <div className="container text-center mt-5">
      <motion.div
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, 10, -10, 10, -10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <AlertTriangle size={80} className="text-warning mb-3" />
      </motion.div>
      <h1 className="display-4">404 - Lost in Space?</h1>
      <p className="lead">
        Looks like you've wandered into uncharted territory.
      </p>
      <p className="text-muted">
        Don't worry! Click below to navigate back safely.
      </p>
      <Link to="/" className="btn btn-primary mt-3">
        Go Home
      </Link>
    </div>
  );
};

export default NotFound;