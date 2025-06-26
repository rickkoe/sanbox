import React from 'react';

const StatusMessage = ({ saveStatus }) => {
  if (!saveStatus) return null;

  const getSaveStatusIcon = () => {
    if (saveStatus.includes("Error") || saveStatus.includes("failed")) return "❌";
    if (saveStatus.includes("successful") || saveStatus.includes("Save successful")) return "✅";
    if (saveStatus.includes("No changes")) return "ℹ️";
    return "⚠️";
  };

  const getSaveStatusVariant = () => {
    if (saveStatus.includes("Error") || saveStatus.includes("failed")) return "error";
    if (saveStatus.includes("successful") || saveStatus.includes("Save successful")) return "success";
    if (saveStatus.includes("No changes")) return "info";
    return "warning";
  };

  return (
    <div className={`status-message status-${getSaveStatusVariant()}`}>
      <span className="status-icon">{getSaveStatusIcon()}</span>
      <span className="status-text">{saveStatus}</span>
    </div>
  );
};

export default StatusMessage;