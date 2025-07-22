import React from "react";

const LoadingSpinner = ({ message = "Loading..." }) => {
  return (
    <div className="loading-state">
      <div className="spinner"></div>
      <span>{message}</span>
    </div>
  );
};

export default LoadingSpinner;