import React, { useState, useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { 
  FaGripVertical, FaTimes, FaCog, FaExpand, FaCompress,
  FaEye, FaEyeSlash, FaClone, FaDownload
} from 'react-icons/fa';
import { WidgetRenderer } from './WidgetRenderer';
import { ResizeHandle } from './ResizeHandle';
import './GridLayoutRenderer.css';

const GRID_COLUMNS = 12;
const WIDGET_MIN_WIDTH = 2;
const WIDGET_MIN_HEIGHT = 200;

export const GridLayoutRenderer = ({
  widgets = [],
  layout,
  editMode,
  onWidgetUpdate,
  onWidgetRemove,
  onWidgetSelect,
  selectedWidget,
  viewMode = 'grid'
}) => {
  const [draggedWidget, setDraggedWidget] = useState(null);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  const gridRef = useRef(null);

  // Calculate grid positioning
  const getGridPosition = useCallback((clientX, clientY) => {
    if (!gridRef.current) return { col: 0, row: 0 };
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const colWidth = rect.width / GRID_COLUMNS;
    const rowHeight = 60; // Approximate row height including gap
    
    const col = Math.floor(x / colWidth);
    const row = Math.floor(y / rowHeight);
    
    return {
      col: Math.max(0, Math.min(GRID_COLUMNS - 1, col)),
      row: Math.max(0, row)
    };
  }, []);

  // Handle widget drop
  const handleWidgetDrop = useCallback((widget, clientOffset) => {
    if (!clientOffset) return;
    
    const gridPos = getGridPosition(clientOffset.x, clientOffset.y);
    
    onWidgetUpdate(widget.id, {
      position_x: gridPos.col,
      position_y: gridPos.row
    });
  }, [getGridPosition, onWidgetUpdate]);

  // Handle widget resize
  const handleWidgetResize = useCallback((widget, newSize) => {
    const maxWidth = GRID_COLUMNS - widget.position_x;
    const width = Math.max(WIDGET_MIN_WIDTH, Math.min(maxWidth, Math.floor(newSize.width / (gridRef.current?.offsetWidth / GRID_COLUMNS))));
    const height = Math.max(WIDGET_MIN_HEIGHT, newSize.height);
    
    onWidgetUpdate(widget.id, { width, height });
  }, [onWidgetUpdate]);

  if (viewMode === 'list') {
    return <ListView widgets={widgets} editMode={editMode} onWidgetUpdate={onWidgetUpdate} onWidgetRemove={onWidgetRemove} />;
  }

  if (viewMode === 'cards') {
    return <CardView widgets={widgets} editMode={editMode} onWidgetUpdate={onWidgetUpdate} onWidgetRemove={onWidgetRemove} />;
  }

  return (
    <div 
      ref={gridRef}
      className={`grid-layout ${editMode ? 'edit-mode' : ''}`}
      style={{
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
        gap: '1rem',
        padding: '1rem'
      }}
    >
      {/* Grid Background (visible in edit mode) */}
      {editMode && (
        <div className="grid-background">
          {Array.from({ length: GRID_COLUMNS * 10 }).map((_, i) => (
            <div key={i} className="grid-cell" />
          ))}
        </div>
      )}

      {/* Render Widgets */}
      {widgets.map(widget => (
        <DraggableWidget
          key={widget.id}
          widget={widget}
          editMode={editMode}
          selected={selectedWidget?.id === widget.id}
          onSelect={() => onWidgetSelect(widget)}
          onUpdate={onWidgetUpdate}
          onRemove={onWidgetRemove}
          onDrop={handleWidgetDrop}
          onResize={handleWidgetResize}
        />
      ))}

      {/* Drop Zone for new widgets */}
      {editMode && <GridDropZone onDrop={handleWidgetDrop} />}
    </div>
  );
};

// Draggable Widget Component
const DraggableWidget = ({
  widget,
  editMode,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  onDrop,
  onResize
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: 'widget',
    item: { widget, type: 'widget' },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    }),
    canDrag: editMode
  });

  const [, drop] = useDrop({
    accept: 'widget',
    drop: (item, monitor) => {
      // Only allow drops on the grid, not on other widgets
      return;
    }
  });

  const widgetStyle = {
    gridColumn: `${widget.position_x + 1} / span ${widget.width}`,
    gridRow: `${widget.position_y + 1}`,
    minHeight: `${widget.height}px`,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative'
  };

  return (
    <div
      ref={(node) => {
        dragPreview(drop(node));
      }}
      className={`widget-container ${selected ? 'selected' : ''} ${editMode ? 'editable' : ''}`}
      style={widgetStyle}
      onClick={() => editMode && onSelect()}
      onMouseEnter={() => editMode && setShowControls(true)}
      onMouseLeave={() => editMode && setShowControls(false)}
    >
      {/* Widget Controls (Edit Mode) */}
      {editMode && (showControls || selected) && (
        <WidgetControls
          widget={widget}
          onRemove={() => onRemove(widget.id)}
          onToggleVisibility={() => onUpdate(widget.id, { is_visible: !widget.is_visible })}
          onClone={() => onUpdate(widget.id, { clone: true })}
        />
      )}

      {/* Drag Handle */}
      {editMode && (
        <div ref={drag} className="drag-handle" title="Drag to move widget">
          <FaGripVertical />
        </div>
      )}

      {/* Widget Content */}
      <div className="widget-content">
        <WidgetRenderer widget={widget} editMode={editMode} />
      </div>

      {/* Resize Handle */}
      {editMode && selected && (
        <ResizeHandle
          onResize={(newSize) => onResize(widget, newSize)}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
        />
      )}

      {/* Selection Outline */}
      {editMode && selected && (
        <div className="selection-outline">
          <div className="selection-info">
            {widget.title} • {widget.width}×{widget.height}
          </div>
        </div>
      )}
    </div>
  );
};

// Widget Controls Component
const WidgetControls = ({ widget, onRemove, onToggleVisibility, onClone }) => (
  <div className="widget-controls">
    <button 
      className="control-btn" 
      onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
      title={widget.is_visible ? "Hide Widget" : "Show Widget"}
    >
      {widget.is_visible ? <FaEye /> : <FaEyeSlash />}
    </button>
    
    <button 
      className="control-btn" 
      onClick={(e) => { e.stopPropagation(); onClone(); }}
      title="Clone Widget"
    >
      <FaClone />
    </button>
    
    <button 
      className="control-btn" 
      onClick={(e) => { e.stopPropagation(); /* TODO: Export widget data */ }}
      title="Export Widget"
    >
      <FaDownload />
    </button>
    
    <button 
      className="control-btn danger" 
      onClick={(e) => { e.stopPropagation(); onRemove(); }}
      title="Remove Widget"
    >
      <FaTimes />
    </button>
  </div>
);

// Grid Drop Zone Component  
const GridDropZone = ({ onDrop }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'widget',
    drop: (item, monitor) => {
      if (monitor.didDrop()) {
        return; // Already handled by a child component
      }
      
      const clientOffset = monitor.getClientOffset();
      if (clientOffset) {
        onDrop(item.widget, clientOffset);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop()
    })
  });

  return (
    <div 
      ref={drop}
      className={`grid-drop-zone ${isOver && canDrop ? 'active' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
        zIndex: 0
      }}
    >
      {isOver && canDrop && (
        <div className="drop-indicator">
          <div className="drop-message">Drop widget here</div>
        </div>
      )}
    </div>
  );
};

// List View Component
const ListView = ({ widgets, editMode, onWidgetUpdate, onWidgetRemove }) => (
  <div className="list-view">
    <div className="list-header">
      <span>Widget</span>
      <span>Type</span>
      <span>Size</span>
      <span>Position</span>
      {editMode && <span>Actions</span>}
    </div>
    <div className="list-body">
      {widgets.map(widget => (
        <div key={widget.id} className="list-item">
          <span className="widget-title">{widget.title}</span>
          <span className="widget-type">{widget.widget_type.display_name}</span>
          <span className="widget-size">{widget.width}×{widget.height}</span>
          <span className="widget-position">({widget.position_x}, {widget.position_y})</span>
          {editMode && (
            <div className="list-actions">
              <button onClick={() => onWidgetRemove(widget.id)} className="btn-remove">
                <FaTimes />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
);

// Card View Component
const CardView = ({ widgets, editMode, onWidgetUpdate, onWidgetRemove }) => (
  <div className="card-view">
    {widgets.map(widget => (
      <div key={widget.id} className="widget-card">
        <div className="card-content">
          {editMode && (
            <button onClick={() => onWidgetRemove(widget.id)} className="btn-remove">
              <FaTimes />
            </button>
          )}
          <WidgetRenderer widget={widget} editMode={editMode} compact />
        </div>
      </div>
    ))}
  </div>
);