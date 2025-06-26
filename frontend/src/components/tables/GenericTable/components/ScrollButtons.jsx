import React from 'react';

const ScrollButtons = ({ showScrollButtons, isAtTop, isAtBottom, scrollToTop, scrollToBottom }) => {
  if (!showScrollButtons) return null;

  return (
    <div className="scroll-buttons">
      {!isAtTop && (
        <button
          onClick={scrollToTop}
          className="scroll-btn scroll-btn-up"
          title="Scroll to top"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18,15 12,9 6,15"/>
          </svg>
        </button>
      )}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="scroll-btn scroll-btn-down"
          title="Scroll to bottom"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      )}
    </div>
  );
};

export default ScrollButtons;