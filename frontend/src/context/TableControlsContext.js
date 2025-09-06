import React, { createContext, useContext, useState } from 'react';

const TableControlsContext = createContext();

export const useTableControls = () => {
  const context = useContext(TableControlsContext);
  if (!context) {
    throw new Error('useTableControls must be used within a TableControlsProvider');
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