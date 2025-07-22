import React from "react";

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-icon"></div>
    <div className="skeleton-content">
      <div className="skeleton-title"></div>
      <div className="skeleton-subtitle"></div>
    </div>
  </div>
);

export const SkeletonDashboard = () => {
  return (
    <div className="dashboard-container">
      {/* Header Skeleton */}
      <div className="dashboard-header">
        <div className="skeleton-header">
          <div className="skeleton-title-large"></div>
          <div className="skeleton-subtitle"></div>
        </div>
        <div className="skeleton-insights">
          <div className="skeleton-status"></div>
        </div>
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="metrics-grid">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Actions Section Skeleton */}
      <div className="actions-section">
        <div className="skeleton-section-title"></div>
        <div className="actions-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
};