import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronUp, ChevronDown } from 'lucide-react';

const ScrollButtons = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  useEffect(() => {
    // Find the actual scrolling container
    // In this app, it's .main-content.scrollable, but fall back to window
    const findScrollContainer = () => {
      const mainContent = document.querySelector('.main-content.scrollable');
      return mainContent || window;
    };

    const container = findScrollContainer();

    const handleScroll = () => {
      let scrollTop, scrollHeight, clientHeight;

      if (container === window) {
        scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        scrollHeight = document.documentElement.scrollHeight;
        clientHeight = window.innerHeight || document.documentElement.clientHeight;
      } else {
        scrollTop = container.scrollTop;
        scrollHeight = container.scrollHeight;
        clientHeight = container.clientHeight;
      }

      const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 50;

      // Show scroll-to-top if scrolled down more than 200px
      const shouldShowTop = scrollTop > 200;
      const shouldShowBottom = !scrolledToBottom && scrollHeight > clientHeight + 100;

      setShowScrollTop(shouldShowTop);
      setShowScrollBottom(shouldShowBottom);
    };

    // Add scroll listener to the correct container
    container.addEventListener('scroll', handleScroll, { passive: true });

    // Check initial state and on resize
    handleScroll();

    // Also listen to resize events
    window.addEventListener('resize', handleScroll, { passive: true });

    // Check after content loads
    const timer1 = setTimeout(handleScroll, 100);
    const timer2 = setTimeout(handleScroll, 500);
    const timer3 = setTimeout(handleScroll, 1000);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const scrollToTop = () => {
    const container = document.querySelector('.main-content.scrollable') || window;
    if (container === window) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const scrollToBottom = () => {
    const container = document.querySelector('.main-content.scrollable') || window;
    if (container === window) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Render buttons using a portal to escape the container hierarchy
  const buttonsContent = (
    <>
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          className="scroll-button scroll-to-top"
          onClick={scrollToTop}
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <ChevronUp size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          className="scroll-button scroll-to-bottom"
          onClick={scrollToBottom}
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={24} strokeWidth={2.5} />
        </button>
      )}
    </>
  );

  // Use portal to render buttons directly to document body
  // This ensures position: fixed works correctly regardless of parent containers
  return ReactDOM.createPortal(buttonsContent, document.body);
};

export default ScrollButtons;
