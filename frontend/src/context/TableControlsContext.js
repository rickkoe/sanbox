import React, { createContext, useContext, useState } from 'react';

const TableControlsContext = createContext({
  tableControlsProps: null,
  setTableControlsProps: () => {}
});

export const useTableControls = () => {
  const context = useContext(TableControlsContext);
  if (!context) {
    console.warn('useTableControls called outside of TableControlsProvider, using defaults');
    return {
      tableControlsProps: null,
      setTableControlsProps: () => {}
    };
  }
  return context;
};

export const TableControlsProvider = ({ children }) => {
  const [tableControlsProps, setTableControlsProps] = useState(null);

  return (
    <TableControlsContext.Provider value={{ tableControlsProps, setTableControlsProps }}>
      {children}
    </TableControlsContext.Provider>
  );
};