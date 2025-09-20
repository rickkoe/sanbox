import React, { useState, useCallback } from 'react';

export const ResizeHandle = ({ onResize, onResizeStart, onResizeEnd }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    
    const rect = e.target.closest('.widget-container').getBoundingClientRect();
    setStartSize({ width: rect.width, height: rect.height });
    
    onResizeStart?.();
  }, [onResizeStart]);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    
    const newSize = {
      width: Math.max(200, startSize.width + deltaX),
      height: Math.max(150, startSize.height + deltaY)
    };
    
    onResize?.(newSize);
  }, [isResizing, startPos, startSize, onResize]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      onResizeEnd?.();
    }
  }, [isResizing, onResizeEnd]);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      className="resize-handle"
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '20px',
        height: '20px',
        cursor: 'nw-resize',
        background: 'linear-gradient(-45deg, transparent 30%, #667eea 50%, transparent 70%)',
        borderRadius: '0 0 8px 0'
      }}
    />
  );
};