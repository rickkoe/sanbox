import React from 'react';

const QuickSearch = ({ quickSearch, setQuickSearch }) => {
  return (
    <div className="quick-search-container">
      <div className="quick-search-wrapper">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Quick search..."
          value={quickSearch}
          onChange={(e) => setQuickSearch(e.target.value)}
          className="quick-search-input"
        />
        {quickSearch && (
          <button
            onClick={() => setQuickSearch('')}
            className="clear-search-btn"
            title="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default QuickSearch;